import type { ConnectionRecord } from '../modules/connections'
import type { DidDocument, Key } from '../modules/dids'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type { OutboundMessage, OutboundPackage, EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'
import type { TransportSession } from './TransportService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { keyReferenceToKey } from '../modules/dids'
import { getKeyDidMappingByVerificationMethod } from '../modules/dids/domain/key-type'
import { DidCommV1Service, IndyAgentService } from '../modules/dids/domain/service'
import { didKeyToInstanceOfKey, verkeyToInstanceOfKey } from '../modules/dids/helpers'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { MessageRepository } from '../storage/MessageRepository'
import { MessageValidator } from '../utils/MessageValidator'
import { getProtocolScheme } from '../utils/uri'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

export interface ResolvedDidCommService {
  id: string
  serviceEndpoint: string
  recipientKeys: Key[]
  routingKeys: Key[]
}

export interface TransportPriorityOptions {
  schemes: string[]
  restrictive?: boolean
}

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private didResolverService: DidResolverService
  public readonly outboundTransports: OutboundTransport[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger,
    didResolverService: DidResolverService
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
    this.didResolverService = didResolverService
    this.outboundTransports = []
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this.outboundTransports.push(outboundTransport)
  }

  public async packMessage({
    keys,
    message,
    endpoint,
  }: {
    keys: EnvelopeKeys
    message: AgentMessage
    endpoint: string
  }): Promise<OutboundPackage> {
    const encryptedMessage = await this.envelopeService.packMessage(message, keys)

    return {
      payload: encryptedMessage,
      responseRequested: message.hasAnyReturnRoute(),
      endpoint,
    }
  }

  private async sendMessageToSession(session: TransportSession, message: AgentMessage) {
    this.logger.debug(`Existing ${session.type} transport session has been found.`, {
      keys: session.keys,
    })
    if (!session.keys) {
      throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
    }
    const encryptedMessage = await this.envelopeService.packMessage(message, session.keys)
    await session.send(encryptedMessage)
  }

  public async sendPackage({
    connection,
    encryptedMessage,
    options,
  }: {
    connection: ConnectionRecord
    encryptedMessage: EncryptedMessage
    options?: { transportPriority?: TransportPriorityOptions }
  }) {
    const errors: Error[] = []

    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting()) {
      try {
        await session.send(encryptedMessage)
        return
      } catch (error) {
        errors.push(error)
        this.logger.debug(`Sending packed message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const { services, queueService } = await this.retrieveServicesByConnection(connection, options?.transportPriority)

    if (this.outboundTransports.length === 0 && !queueService) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      this.logger.debug(`Sending outbound message to service:`, { service })
      try {
        const protocolScheme = getProtocolScheme(service.serviceEndpoint)
        for (const transport of this.outboundTransports) {
          if (transport.supportedSchemes.includes(protocolScheme)) {
            await transport.sendMessage({
              payload: encryptedMessage,
              endpoint: service.serviceEndpoint,
              connectionId: connection.id,
            })
            break
          }
        }
        return
      } catch (error) {
        this.logger.debug(
          `Sending outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }

    // We didn't succeed to send the message over open session, or directly to serviceEndpoint
    // If the other party shared a queue service endpoint in their did doc we queue the message
    if (queueService) {
      this.logger.debug(`Queue packed message for connection ${connection.id} (${connection.theirLabel})`)
      this.messageRepository.add(connection.id, encryptedMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: encryptedMessage,
      errors,
      connection,
    })
    throw new AriesFrameworkError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  public async sendMessage(
    outboundMessage: OutboundMessage,
    options?: {
      transportPriority?: TransportPriorityOptions
    }
  ) {
    const { connection, outOfBand, sessionId, payload } = outboundMessage
    const errors: Error[] = []

    this.logger.debug('Send outbound message', {
      message: payload,
      connectionId: connection.id,
    })

    let session: TransportSession | undefined

    if (sessionId) {
      session = this.transportService.findSessionById(sessionId)
    }
    if (!session) {
      // Try to send to already open session
      session =
        this.transportService.findSessionByConnectionId(connection.id) ||
        (outOfBand && this.transportService.findSessionByOutOfBandId(outOfBand.id))
    }

    if (session?.inboundMessage?.hasReturnRouting(payload.threadId)) {
      this.logger.debug(`Found session with return routing for message '${payload.id}' (connection '${connection.id}'`)
      try {
        await this.sendMessageToSession(session, payload)
        return
      } catch (error) {
        errors.push(error)
        this.logger.debug(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const { services, queueService } = await this.retrieveServicesByConnection(
      connection,
      options?.transportPriority,
      outOfBand
    )

    const ourDidDocument = await this.resolveDidDocument(connection.did)
    const ourAuthenticationKeys = getAuthenticationKeys(ourDidDocument)

    // TODO We're selecting just the first authentication key. Is it ok?
    // We can probably learn something from the didcomm-rust implementation, which looks at crypto compatibility to make sure the
    // other party can decrypt the message. https://github.com/sicpa-dlab/didcomm-rust/blob/9a24b3b60f07a11822666dda46e5616a138af056/src/message/pack_encrypted/mod.rs#L33-L44
    // This will become more relevant when we support different encrypt envelopes. One thing to take into account though is that currently we only store the recipientKeys
    // as defined in the didcomm services, while it could be for example that the first authentication key is not defined in the recipientKeys, in which case we wouldn't
    // even be interoperable between two AFJ agents. So we should either pick the first key that is defined in the recipientKeys, or we should make sure to store all
    // keys defined in the did document as tags so we can retrieve it, even if it's not defined in the recipientKeys. This, again, will become simpler once we use didcomm v2
    // as the `from` field in a received message will identity the did used so we don't have to store all keys in tags to be able to find the connections associated with
    // an incoming message.
    const [firstOurAuthenticationKey] = ourAuthenticationKeys
    const shouldUseReturnRoute = !this.transportService.hasInboundEndpoint(ourDidDocument)

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      try {
        // Enable return routing if the our did document does not have any inbound endpoint for given sender key
        await this.sendMessageToService({
          message: payload,
          service,
          senderKey: firstOurAuthenticationKey,
          returnRoute: shouldUseReturnRoute,
          connectionId: connection.id,
        })
        return
      } catch (error) {
        errors.push(error)
        this.logger.debug(
          `Sending outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }

    // We didn't succeed to send the message over open session, or directly to serviceEndpoint
    // If the other party shared a queue service endpoint in their did doc we queue the message
    if (queueService) {
      this.logger.debug(`Queue message for connection ${connection.id} (${connection.theirLabel})`)

      const keys = {
        recipientKeys: queueService.recipientKeys,
        routingKeys: queueService.routingKeys,
        senderKey: firstOurAuthenticationKey,
      }

      const encryptedMessage = await this.envelopeService.packMessage(payload, keys)
      this.messageRepository.add(connection.id, encryptedMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: payload,
      errors,
      connection,
    })
    throw new AriesFrameworkError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  public async sendMessageToService({
    message,
    service,
    senderKey,
    returnRoute,
    connectionId,
  }: {
    message: AgentMessage
    service: ResolvedDidCommService
    senderKey: Key
    returnRoute?: boolean
    connectionId?: string
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    this.logger.debug(`Sending outbound message to service:`, { messageId: message.id, service })

    const keys = {
      recipientKeys: service.recipientKeys,
      routingKeys: service.routingKeys,
      senderKey,
    }

    // Set return routing for message if requested
    if (returnRoute) {
      message.setReturnRouting(ReturnRouteTypes.all)
    }

    try {
      await MessageValidator.validate(message)
    } catch (error) {
      this.logger.error(
        `Aborting sending outbound message ${message.type} to ${service.serviceEndpoint}. Message validation failed`,
        {
          errors: error,
          message: message.toJSON(),
        }
      )

      throw error
    }

    const outboundPackage = await this.packMessage({ message, keys, endpoint: service.serviceEndpoint })
    outboundPackage.endpoint = service.serviceEndpoint
    outboundPackage.connectionId = connectionId
    for (const transport of this.outboundTransports) {
      const protocolScheme = getProtocolScheme(service.serviceEndpoint)
      if (!protocolScheme) {
        this.logger.warn('Service does not have valid protocolScheme.')
      } else if (transport.supportedSchemes.includes(protocolScheme)) {
        await transport.sendMessage(outboundPackage)
        break
      }
    }
  }

  private async retrieveServicesFromDid(did: string) {
    this.logger.debug(`Resolving services for did ${did}.`)
    const didDocument = await this.resolveDidDocument(did)

    const didCommServices: ResolvedDidCommService[] = []

    // FIXME: we currently retrieve did documents for all didcomm services in the did document, and we don't have caching
    // yet so this will re-trigger ledger resolves for each one. Should we only resolve the first service, then the second service, etc...?
    for (const didCommService of didDocument.didCommServices) {
      if (didCommService instanceof IndyAgentService) {
        // IndyAgentService (DidComm v0) has keys encoded as raw publicKeyBase58 (verkeys)
        didCommServices.push({
          id: didCommService.id,
          recipientKeys: didCommService.recipientKeys.map(verkeyToInstanceOfKey),
          routingKeys: didCommService.routingKeys?.map(verkeyToInstanceOfKey) || [],
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      } else if (didCommService instanceof DidCommV1Service) {
        // Resolve dids to DIDDocs to retrieve routingKeys
        const routingKeys = []
        for (const routingKey of didCommService.routingKeys ?? []) {
          const routingDidDocument = await this.resolveDidDocument(routingKey)
          routingKeys.push(keyReferenceToKey(routingDidDocument, routingKey))
        }

        // Dereference recipientKeys
        const recipientKeys = didCommService.recipientKeys.map((recipientKey) =>
          keyReferenceToKey(didDocument, recipientKey)
        )

        // DidCommV1Service has keys encoded as key references
        didCommServices.push({
          id: didCommService.id,
          recipientKeys,
          routingKeys,
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      }
    }

    return didCommServices
  }

  private async retrieveServicesByConnection(
    connection: ConnectionRecord,
    transportPriority?: TransportPriorityOptions,
    outOfBand?: OutOfBandRecord
  ) {
    this.logger.debug(`Retrieving services for connection '${connection.id}' (${connection.theirLabel})`, {
      transportPriority,
      connection,
    })

    let didCommServices: ResolvedDidCommService[] = []

    if (connection.theirDid) {
      this.logger.debug(`Resolving services for connection theirDid ${connection.theirDid}.`)
      didCommServices = await this.retrieveServicesFromDid(connection.theirDid)
    } else if (outOfBand) {
      this.logger.debug(`Resolving services from out-of-band record ${outOfBand?.id}.`)
      if (connection.isRequester) {
        for (const service of outOfBand.outOfBandInvitation.services) {
          // Resolve dids to DIDDocs to retrieve services
          if (typeof service === 'string') {
            didCommServices = await this.retrieveServicesFromDid(service)
          } else {
            // Out of band inline service contains keys encoded as did:key references
            didCommServices.push({
              id: service.id,
              recipientKeys: service.recipientKeys.map(didKeyToInstanceOfKey),
              routingKeys: service.routingKeys?.map(didKeyToInstanceOfKey) || [],
              serviceEndpoint: service.serviceEndpoint,
            })
          }
        }
      }
    }

    // Separate queue service out
    let services = didCommServices.filter((s) => !isDidCommTransportQueue(s.serviceEndpoint))
    const queueService = didCommServices.find((s) => isDidCommTransportQueue(s.serviceEndpoint))

    // If restrictive will remove services not listed in schemes list
    if (transportPriority?.restrictive) {
      services = services.filter((service) => {
        const serviceSchema = getProtocolScheme(service.serviceEndpoint)
        return transportPriority.schemes.includes(serviceSchema)
      })
    }

    // If transport priority is set we will sort services by our priority
    if (transportPriority?.schemes) {
      services = services.sort(function (a, b) {
        const aScheme = getProtocolScheme(a.serviceEndpoint)
        const bScheme = getProtocolScheme(b.serviceEndpoint)
        return transportPriority?.schemes.indexOf(aScheme) - transportPriority?.schemes.indexOf(bScheme)
      })
    }

    this.logger.debug(
      `Retrieved ${services.length} services for message to connection '${connection.id}'(${connection.theirLabel})'`,
      { hasQueueService: queueService !== undefined }
    )
    return { services, queueService }
  }

  private async resolveDidDocument(did: string) {
    const {
      didDocument,
      didResolutionMetadata: { error, message },
    } = await this.didResolverService.resolve(did)

    if (!didDocument) {
      throw new AriesFrameworkError(`Unable to resolve did document for did '${did}': ${error} ${message}`)
    }
    return didDocument
  }
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}

function getAuthenticationKeys(didDocument: DidDocument) {
  return didDocument.authentication.map((authentication) => {
    const verificationMethod =
      typeof authentication === 'string' ? didDocument.dereferenceVerificationMethod(authentication) : authentication
    const { getKeyFromVerificationMethod } = getKeyDidMappingByVerificationMethod(verificationMethod)
    const key = getKeyFromVerificationMethod(verificationMethod)
    return key
  })
}
