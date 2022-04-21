import type { ConnectionRecord } from '../modules/connections'
import type { DidDocument } from '../modules/dids'
import type { IndyAgentService, DidCommService } from '../modules/dids/domain/service'
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
import { getKeyDidMappingByVerificationMethod } from '../modules/dids/domain/key-type'
import { stringToInstanceOfKey } from '../modules/dids/helpers'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { MessageRepository } from '../storage/MessageRepository'
import { MessageValidator } from '../utils/MessageValidator'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

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
        for (const transport of this.outboundTransports) {
          if (transport.supportedSchemes.includes(service.protocolScheme)) {
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
    const { connection, outOfBand, payload } = outboundMessage
    const errors: Error[] = []

    this.logger.debug('Send outbound message', {
      message: payload,
      connectionId: connection.id,
    })

    // Try to send to already open session
    const session =
      this.transportService.findSessionByConnectionId(connection.id) ||
      (outOfBand && this.transportService.findSessionByOutOfBandId(outOfBand.id))

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

      // TODO We should add a method to return instances of Key rather than keys as a string
      const keys = {
        recipientKeys: queueService.recipientKeys.map(stringToInstanceOfKey),
        routingKeys: queueService.routingKeys?.map(stringToInstanceOfKey) || [],
        senderKey: stringToInstanceOfKey(firstOurAuthenticationKey),
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
    service: DidCommService
    senderKey: string
    returnRoute?: boolean
    connectionId?: string
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    this.logger.debug(`Sending outbound message to service:`, { messageId: message.id, service })

    // TODO We should add a method to return instances of Key rather than keys as a string
    const keys = {
      recipientKeys: service.recipientKeys.map(stringToInstanceOfKey),
      routingKeys: service.routingKeys?.map(stringToInstanceOfKey) || [],
      senderKey: stringToInstanceOfKey(senderKey),
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
      const protocolScheme = service.protocolScheme ?? service.serviceEndpoint.split(':')[0]
      if (!protocolScheme) {
        this.logger.warn('Service does not have valid procolScheme.')
      } else if (transport.supportedSchemes.includes(protocolScheme)) {
        await transport.sendMessage(outboundPackage)
        break
      }
    }
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

    let didCommServices: Array<IndyAgentService | DidCommService> = []
    // If theirDid starts with a did: prefix it means we're using the new did syntax
    // and we should use the did resolver
    if (connection.theirDid) {
      this.logger.debug(`Resolving services for connection theirDid ${connection.theirDid}.`)
      const didDocument = await this.resolveDidDocument(connection.theirDid)
      didCommServices = didDocument.didCommServices
    } else if (outOfBand) {
      this.logger.debug(`Resolving services from out-of-band record ${outOfBand?.id}.`)
      if (connection.isRequester && outOfBand) {
        for (const service of outOfBand.outOfBandMessage.services) {
          // Resolve dids to DIDDocs to retrieve services
          if (typeof service === 'string') {
            const did = service
            const didDocument = await this.resolveDidDocument(did)
            didCommServices = [...didCommServices, ...didDocument.didCommServices]
          } else {
            // Inline service blocks can just be pushed
            didCommServices.push(service)
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
        const serviceSchema = service.protocolScheme
        return transportPriority.schemes.includes(serviceSchema)
      })
    }

    // If transport priority is set we will sort services by our priority
    if (transportPriority?.schemes) {
      services = services.sort(function (a, b) {
        const aScheme = a.protocolScheme
        const bScheme = b.protocolScheme
        return transportPriority?.schemes.indexOf(aScheme) - transportPriority?.schemes.indexOf(bScheme)
      })
    }

    this.logger.debug(
      `Retrieved ${services.length} services for message to connection '${connection.id}'(${connection.theirLabel})'`
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
      typeof authentication === 'string' ? didDocument.dereferenceKey(authentication) : authentication
    const { getKeyFromVerificationMethod } = getKeyDidMappingByVerificationMethod(verificationMethod)
    const key = getKeyFromVerificationMethod(verificationMethod)
    return key.publicKeyBase58
  })
}
