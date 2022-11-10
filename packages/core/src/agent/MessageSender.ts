import type { Key } from '../crypto'
import type { ConnectionRecord } from '../modules/connections'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { DidCommV2Service, DidDocument, DidDocumentService } from '../modules/dids'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type {
  OutboundDIDCommV1Message,
  OutboundDIDCommV2Message,
  OutboundPackage,
  OutboundPackagePayload,
} from '../types'
import type { TransportSession } from './TransportService'
import type { AgentContext } from './context'
import type { DIDCommMessage, DIDCommV2Message, EncryptedMessage } from './didcomm'
import type { PackMessageParams } from './didcomm/EnvelopeService'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError, MessageSendingError } from '../error'
import { Logger } from '../logger'
import { DidCommDocumentService } from '../modules/didcomm'
import { getKeyDidMappingByVerificationMethod } from '../modules/dids/domain/key-type'
import { didKeyToInstanceOfKey } from '../modules/dids/helpers'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { OutOfBandRepository } from '../modules/oob/repository'
import { inject, injectable } from '../plugins'
import { MessageRepository } from '../storage/MessageRepository'
import { MessageValidator } from '../utils/MessageValidator'
import { getProtocolScheme } from '../utils/uri'

import { TransportService } from './TransportService'
import { EnvelopeService } from './didcomm/EnvelopeService'
import { DIDCommMessageVersion, MessageType } from './didcomm/types'

export interface TransportPriorityOptions {
  schemes: string[]
  restrictive?: boolean
}

@injectable()
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private didResolverService: DidResolverService
  private didCommDocumentService: DidCommDocumentService
  private outOfBandRepository: OutOfBandRepository
  public readonly outboundTransports: OutboundTransport[] = []
  public readonly outboundTransportsSchemas: string[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger,
    didResolverService: DidResolverService,
    didCommDocumentService: DidCommDocumentService,
    outOfBandRepository: OutOfBandRepository
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
    this.didResolverService = didResolverService
    this.didCommDocumentService = didCommDocumentService
    this.outOfBandRepository = outOfBandRepository
    this.outboundTransports = []
    this.outboundTransportsSchemas = []
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this.outboundTransports.push(outboundTransport)
    this.outboundTransportsSchemas.push(...outboundTransport.supportedSchemes)
  }

  public async packMessage(
    agentContext: AgentContext,
    {
      keys,
      message,
      endpoint,
    }: {
      keys: PackMessageParams
      message: DIDCommMessage
      endpoint: string
    }
  ): Promise<OutboundPackage> {
    const encryptedMessage = await this.envelopeService.packMessageEncrypted(agentContext, message, keys)

    return {
      payload: encryptedMessage,
      responseRequested: message.hasAnyReturnRoute(),
      endpoint,
    }
  }

  private async sendMessageToSession(agentContext: AgentContext, session: TransportSession, message: DIDCommMessage) {
    this.logger.debug(`Existing ${session.type} transport session has been found.`)
    if (!session.keys) {
      throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
    }
    const encryptedMessage = await this.envelopeService.packMessageEncrypted(agentContext, message, session.keys)
    await session.send(encryptedMessage)
  }

  public async sendPackage(
    agentContext: AgentContext,
    {
      connection,
      encryptedMessage,
      options,
    }: {
      connection: ConnectionRecord
      encryptedMessage: EncryptedMessage
      options?: { transportPriority?: TransportPriorityOptions }
    }
  ) {
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
    const { services, queueService } = await this.retrieveServicesByConnection(
      agentContext,
      connection,
      options?.transportPriority
    )

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
      await this.messageRepository.add(connection.id, encryptedMessage)
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
    agentContext: AgentContext,
    outboundMessage: OutboundDIDCommV1Message | OutboundDIDCommV2Message,
    options?: {
      transportPriority?: TransportPriorityOptions
    }
  ) {
    if (outboundMessage.payload.version === DIDCommMessageVersion.V1) {
      return this.sendDIDCommV1Message(agentContext, outboundMessage as OutboundDIDCommV1Message, options)
    }
    if (outboundMessage.payload.version === DIDCommMessageVersion.V2) {
      return this.sendDIDCommV2Message(agentContext, outboundMessage as OutboundDIDCommV2Message, options)
    }
    throw new AriesFrameworkError(`Unexpected case`)
  }

  public async sendDIDCommV1Message(
    agentContext: AgentContext,
    outboundMessage: OutboundDIDCommV1Message,
    options?: {
      sendingMessageType?: MessageType
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
      session = this.transportService.findSessionByConnectionId(connection.id)
    }

    if (session?.inboundMessage?.hasReturnRouting(payload.threadId)) {
      this.logger.debug(`Found session with return routing for message '${payload.id}' (connection '${connection.id}'`)
      try {
        await this.sendMessageToSession(agentContext, session, payload)
        return
      } catch (error) {
        errors.push(error)
        this.logger.debug(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const { services, queueService } = await this.retrieveServicesByConnection(
      agentContext,
      connection,
      options?.transportPriority,
      outOfBand
    )

    if (!connection.did) {
      this.logger.error(`Unable to send message using connection '${connection.id}' that doesn't have a did`)
      throw new MessageSendingError(
        `Unable to send message using connection '${connection.id}' that doesn't have a did`,
        { outboundMessage }
      )
    }

    const ourDidDocument = await this.didResolverService.resolveDidDocument(agentContext, connection.did)
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
    // If the returnRoute is already set we won't override it. This allows to set the returnRoute manually if this is desired.
    const shouldAddReturnRoute =
      payload.transport?.returnRoute === undefined && !this.transportService.hasInboundEndpoint(ourDidDocument)

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      try {
        // Enable return routing if the our did document does not have any inbound endpoint for given sender key
        await this.sendMessageToService(agentContext, {
          message: payload,
          service,
          senderKey: firstOurAuthenticationKey,
          returnRoute: shouldAddReturnRoute,
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

      const encryptedMessage = await this.envelopeService.packMessageEncrypted(agentContext, payload, keys)
      await this.messageRepository.add(connection.id, encryptedMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: payload,
      errors,
      connection,
    })
    throw new MessageSendingError(
      `Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`,
      { outboundMessage }
    )
  }

  public async sendMessageToService(
    agentContext: AgentContext,
    {
      message,
      service,
      senderKey,
      returnRoute,
      connectionId,
    }: {
      message: DIDCommMessage
      service: ResolvedDidCommService
      senderKey: Key
      returnRoute?: boolean
      connectionId?: string
    }
  ) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    this.logger.debug(`Sending outbound message to service:`, {
      messageId: message.id,
      service: { ...service, recipientKeys: 'omitted...', routingKeys: 'omitted...' },
    })

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
      MessageValidator.validateSync(message)
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

    const outboundPackage = await this.packMessage(agentContext, { message, keys, endpoint: service.serviceEndpoint })
    outboundPackage.endpoint = service.serviceEndpoint
    outboundPackage.connectionId = connectionId
    for (const transport of this.outboundTransports) {
      const protocolScheme = getProtocolScheme(service.serviceEndpoint)
      if (!protocolScheme) {
        this.logger.warn('Service does not have valid protocolScheme.')
      } else if (transport.supportedSchemes.includes(protocolScheme)) {
        await transport.sendMessage(outboundPackage)
        return
      }
    }
    throw new AriesFrameworkError(`Unable to send message to service: ${service.serviceEndpoint}`)
  }

  private async retrieveServicesByConnection(
    agentContext: AgentContext,
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
      didCommServices = await this.didCommDocumentService.resolveServicesFromDid(agentContext, connection.theirDid)
    } else if (outOfBand) {
      this.logger.debug(`Resolving services from out-of-band record ${outOfBand.id}.`)
      if (connection.isRequester) {
        for (const service of outOfBand.outOfBandInvitation.getServices()) {
          // Resolve dids to DIDDocs to retrieve services
          if (typeof service === 'string') {
            this.logger.debug(`Resolving services for did ${service}.`)
            didCommServices.push(...(await this.didCommDocumentService.resolveServicesFromDid(agentContext, service)))
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

  public async sendDIDCommV2Message(
    agentContext: AgentContext,
    outboundMessage: OutboundDIDCommV2Message,
    options?: {
      sendingMessageType?: MessageType
      transportPriority?: TransportPriorityOptions
    }
  ) {
    const { payload: message } = outboundMessage
    const sendingMessageType = options?.sendingMessageType || MessageType.Encrypted

    // recipient is not specified -> send to defaultTransport
    const recipient = message.recipient()
    if (!recipient) {
      throw new AriesFrameworkError(`Unable to send message. Message doesn't contain recipient DID.`)
    }

    // find service transport supported for both sender and receiver
    const senderToRecipientService = await this.findCommonSupportedServices(
      agentContext,
      recipient,
      message.sender,
      options?.transportPriority
    )
    if (!senderToRecipientService) {
      this.logger.error(
        `Unable to send message ${message.id} because there is no any commonly supported service between sender and recipient`
      )
      return
    }

    if (sendingMessageType === MessageType.Plain) {
      // send message plaintext
      return await this.sendDIDCommV2PlaintextMessage(agentContext, message, senderToRecipientService)
    }

    if (sendingMessageType === MessageType.Signed) {
      // send message signed
      return await this.sendDIDCommV2SignedMessage(agentContext, message, senderToRecipientService)
    }

    if (sendingMessageType === MessageType.Encrypted) {
      // send message encrypted
      return await this.sendDIDCommV2EncryptedMessage(agentContext, message, senderToRecipientService)
    }
  }

  public async findCommonSupportedServices(
    agentContext: AgentContext,
    recipient: string,
    sender?: string,
    transportPriority?: TransportPriorityOptions
  ): Promise<DidCommV2Service[] | undefined> {
    if (!sender) return undefined

    const { didDocument: senderDidDocument } = await this.didResolverService.resolve(agentContext, sender)

    const { didDocument: recipientDidDocument } = await this.didResolverService.resolve(agentContext, recipient)
    if (!recipientDidDocument) {
      throw new AriesFrameworkError(`Unable to resolve did document for did '${recipient}'`)
    }

    const senderServices = senderDidDocument?.service || []
    const recipientServices = recipientDidDocument?.service || []

    const senderTransports = senderServices.length
      ? senderServices.map((service) => service.protocolScheme)
      : this.outboundTransportsSchemas

    const supportedTransports = transportPriority
      ? [...transportPriority.schemes, ...senderTransports]
      : senderTransports

    // Sort services according to supported transports
    const priority = supportedTransports.map((transport) => transport.toString())

    const services = recipientServices.sort(function (a, b) {
      return priority.indexOf(a.protocolScheme) - priority.indexOf(b.protocolScheme)
    })

    const commonServices = services.filter((service) => {
      if (priority.includes(service.protocolScheme)) return service
    })

    return commonServices
  }

  private async sendDIDCommV2PlaintextMessage(
    agentContext: AgentContext,
    message: DIDCommV2Message,
    services: DidDocumentService[]
  ) {
    this.logger.debug(`Sending plaintext message ${message.id}`)
    const recipientDid = message.recipient()
    return this.sendOutboundDIDCommV2Message(agentContext, message, services, recipientDid)
  }

  private async sendDIDCommV2SignedMessage(
    agentContext: AgentContext,
    message: DIDCommV2Message,
    services: DidDocumentService[]
  ) {
    this.logger.debug(`Sending JWS message ${message.id}`)

    const recipientDid = message.recipient()

    const pack = async (message: DIDCommV2Message, service: DidDocumentService) => {
      if (!message.from) {
        throw new AriesFrameworkError(`Unable to send message signed. Message doesn't contain sender DID.`)
      }
      const params = { signByDID: message.from, serviceId: service?.id }
      return this.envelopeService.packMessageSigned(agentContext, message, params)
    }

    return this.sendOutboundDIDCommV2Message(agentContext, message, services, recipientDid, pack)
  }

  private async sendDIDCommV2EncryptedMessage(
    agentContext: AgentContext,
    message: DIDCommV2Message,
    services: DidDocumentService[]
  ) {
    const recipientDid = message.recipient()
    if (!recipientDid) {
      throw new AriesFrameworkError(`Unable to send message encrypted. Message doesn't contain recipient DID.`)
    }
    this.logger.debug(`Sending JWE message ${message.id}`)

    const pack = async (message: DIDCommV2Message, service: DidDocumentService) => {
      return await this.encryptDIDCommV2Message(agentContext, message, service)
    }

    return this.sendOutboundDIDCommV2Message(agentContext, message, services, recipientDid, pack)
  }

  private async encryptDIDCommV2Message(
    agentContext: AgentContext,
    message: DIDCommV2Message,
    service: DidDocumentService,
    forward?: boolean
  ) {
    const recipientDid = message.recipient()
    if (!recipientDid) {
      throw new AriesFrameworkError(`Unable to send message encrypted. Message doesn't contain recipient DID.`)
    }

    const params = {
      toDID: recipientDid,
      fromDID: message.from,
      signByDID: undefined,
      serviceId: service?.id,
      forward,
    }
    return this.envelopeService.packMessageEncrypted(agentContext, message, params)
  }

  public async sendOutboundDIDCommV2Message(
    agentContext: AgentContext,
    message: DIDCommV2Message,
    services: DidDocumentService[],
    recipientDid?: string,
    packMessage?: (message: DIDCommV2Message, service: DidDocumentService) => Promise<OutboundPackagePayload>
  ) {
    for (const service of services) {
      try {
        this.logger.info(`Sending message to ${service.serviceEndpoint}. Transport ${service.protocolScheme}`)

        const payload = packMessage ? await packMessage(message, service) : { ...message }
        const outboundPackage = { payload, recipientDid, endpoint: service.serviceEndpoint }

        this.logger.trace(`Sending outbound message to transport:`, {
          transport: service.protocolScheme,
          outboundPackage,
        })

        for (const outboundTransport of this.outboundTransports) {
          if (outboundTransport.supportedSchemes.includes(service.protocolScheme)) {
            await outboundTransport.sendMessage(outboundPackage)
            break
          }
        }

        this.logger.info(
          `Message sent ${message.id} to ${service.serviceEndpoint}. Transport ${service.protocolScheme}`
        )
        return
      } catch (error) {
        this.logger.warn(`Unable to send message to ${service.serviceEndpoint}. Transport failure `, {
          errors: error,
        })
        // ignore and try another transport
      }
    }
    this.logger.error(`Unable to send message ${message.id} through any commonly supported transport.`)
  }
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}

function getAuthenticationKeys(didDocument: DidDocument) {
  return (
    didDocument.authentication?.map((authentication) => {
      const verificationMethod =
        typeof authentication === 'string' ? didDocument.dereferenceVerificationMethod(authentication) : authentication
      const { getKeyFromVerificationMethod } = getKeyDidMappingByVerificationMethod(verificationMethod)
      const key = getKeyFromVerificationMethod(verificationMethod)
      return key
    }) ?? []
  )
}
