import type { AgentMessage } from './AgentMessage'
import type { PackMessageParams } from './EnvelopeService'
import type { AgentMessageSentEvent } from './Events'
import type { TransportSession } from './TransportService'
import type { AgentContext } from './context'
import type {
  DidCommV1Message,
  DidCommV2Message,
  DidCommV2PackMessageParams,
  EncryptedMessage,
  EnvelopeType,
  OutboundPackage,
} from '../didcomm'
import type { ConnectionRecord } from '../modules/connections'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { DidDocument } from '../modules/dids'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { OutboundTransport } from '../transport/OutboundTransport'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { isDidCommV1Message, isDidCommV2Message } from '../didcomm/'
import { AriesFrameworkError, MessageSendingError } from '../error'
import { Logger } from '../logger'
import { DidCommDocumentService } from '../modules/didcomm/services/DidCommDocumentService'
import { DidCommV2Service, getAuthenticationKeys } from '../modules/dids'
import { didKeyToInstanceOfKey } from '../modules/dids/helpers'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { inject, injectable } from '../plugins'
import { MessageRepository } from '../storage/MessageRepository'
import { MessageValidator } from '../utils/MessageValidator'
import { getProtocolScheme } from '../utils/uri'

import { EnvelopeService } from './EnvelopeService'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { TransportService } from './TransportService'
import { OutboundMessageContext, OutboundMessageSendStatus } from './models'

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
  private eventEmitter: EventEmitter
  private _outboundTransports: OutboundTransport[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger,
    didResolverService: DidResolverService,
    didCommDocumentService: DidCommDocumentService,
    eventEmitter: EventEmitter
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
    this.didResolverService = didResolverService
    this.didCommDocumentService = didCommDocumentService
    this.eventEmitter = eventEmitter
    this._outboundTransports = []
  }

  public get outboundTransports() {
    return this._outboundTransports
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this._outboundTransports.push(outboundTransport)
  }

  public async unregisterOutboundTransport(outboundTransport: OutboundTransport) {
    this._outboundTransports = this.outboundTransports.filter((transport) => transport !== outboundTransport)
    await outboundTransport.stop()
  }

  public async sendMessage(
    outboundMessage: OutboundMessageContext,
    options?: {
      transportPriority?: TransportPriorityOptions
    }
  ) {
    if (isDidCommV1Message(outboundMessage.message)) {
      return this.sendDIDCommV1Message(outboundMessage, options)
    }
    if (isDidCommV2Message(outboundMessage.message)) {
      return this.sendDIDCommV2Message(outboundMessage, options)
    }
    throw new AriesFrameworkError(`Unexpected case`)
  }

  public async packMessage(
    agentContext: AgentContext,
    {
      params,
      message,
      endpoint,
    }: {
      params: PackMessageParams
      message: AgentMessage
      endpoint: string
    }
  ): Promise<OutboundPackage> {
    const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, params)

    return {
      payload: encryptedMessage,
      responseRequested: message.hasAnyReturnRoute(),
      endpoint,
    }
  }

  private async sendMessageToSession(agentContext: AgentContext, session: TransportSession, message: AgentMessage) {
    this.logger.debug(`Existing ${session.type} transport session has been found.`)
    if (!session.keys) {
      throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
    }
    const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, session.keys)
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

  private async sendDIDCommV1Message(
    outboundMessageContext: OutboundMessageContext,
    options?: {
      envelopeType?: EnvelopeType
      transportPriority?: TransportPriorityOptions
    }
  ) {
    const { agentContext, connection, outOfBand } = outboundMessageContext
    const message = outboundMessageContext.message as DidCommV1Message

    const errors: Error[] = []

    if (!connection) {
      this.logger.error('Outbound message has no associated connection')
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError('Outbound message has no associated connection', {
        outboundMessageContext,
      })
    }

    this.logger.debug('Send outbound message', {
      message,
      connectionId: connection?.id,
    })

    const session = this.findSessionForOutboundContext(outboundMessageContext)

    if (session) {
      this.logger.debug(`Found session with return routing for message '${message.id}' (connection '${connection.id}'`)
      try {
        await this.sendMessageToSession(agentContext, session, message)
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToSession)
        return
      } catch (error) {
        errors.push(error)
        this.logger.debug(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    let services: ResolvedDidCommService[] = []
    let queueService: ResolvedDidCommService | undefined

    try {
      ;({ services, queueService } = await this.retrieveServicesByConnection(
        agentContext,
        connection,
        options?.transportPriority,
        outOfBand
      ))
    } catch (error) {
      this.logger.error(`Unable to retrieve services for connection '${connection.id}. ${error.message}`)
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError(`Unable to retrieve services for connection '${connection.id}`, {
        outboundMessageContext,
        cause: error,
      })
    }

    if (!connection.did) {
      this.logger.error(`Unable to send message using connection '${connection.id}' that doesn't have a did`)
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError(
        `Unable to send message using connection '${connection.id}' that doesn't have a did`,
        { outboundMessageContext }
      )
    }

    let ourDidDocument: DidDocument
    try {
      ourDidDocument = await this.didResolverService.resolveDidDocument(agentContext, connection.did)
    } catch (error) {
      this.logger.error(`Unable to resolve DID Document for '${connection.did}`)
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError(`Unable to resolve DID Document for '${connection.did}`, {
        outboundMessageContext,
        cause: error,
      })
    }

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
      message.transport?.returnRoute === undefined && !this.transportService.hasInboundEndpoint(ourDidDocument)

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      try {
        // Enable return routing if the our did document does not have any inbound endpoint for given sender key
        await this.sendToService(
          new OutboundMessageContext(message, {
            agentContext,
            serviceParams: {
              service,
              senderKey: firstOurAuthenticationKey,
              returnRoute: shouldAddReturnRoute,
            },
            connection,
          })
        )
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToTransport)
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

      const params = {
        recipientKeys: queueService.recipientKeys,
        routingKeys: queueService.routingKeys,
        senderKey: firstOurAuthenticationKey,
      }

      const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, params)
      await this.messageRepository.add(connection.id, encryptedMessage)

      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.QueuedForPickup)

      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message,
      errors,
      connection,
    })
    this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)

    throw new MessageSendingError(
      `Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`,
      { outboundMessageContext }
    )
  }

  public async sendMessageToService(outboundMessageContext: OutboundMessageContext) {
    const session = this.findSessionForOutboundContext(outboundMessageContext)

    if (session) {
      this.logger.debug(`Found session with return routing for message '${outboundMessageContext.message.id}'`)
      try {
        await this.sendMessageToSession(outboundMessageContext.agentContext, session, outboundMessageContext.message)
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToSession)
        return
      } catch (error) {
        this.logger.debug(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // If there is no session try sending to service instead
    try {
      await this.sendToService(outboundMessageContext)
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToTransport)
    } catch (error) {
      this.logger.error(
        `Message is undeliverable to service with id ${outboundMessageContext.serviceParams?.service.id}: ${error.message}`,
        {
          message: outboundMessageContext.message,
          error,
        }
      )
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)

      throw new MessageSendingError(
        `Message is undeliverable to service with id ${outboundMessageContext.serviceParams?.service.id}: ${error.message}`,
        { outboundMessageContext }
      )
    }
  }

  private async sendToService(outboundMessageContext: OutboundMessageContext) {
    const { agentContext, message, serviceParams, connection } = outboundMessageContext

    if (!serviceParams) {
      throw new AriesFrameworkError('No service parameters found in outbound message context')
    }
    const { service, senderKey, returnRoute } = serviceParams

    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    this.logger.debug(`Sending outbound message to service:`, {
      messageId: message.id,
      service: { ...service, recipientKeys: 'omitted...', routingKeys: 'omitted...' },
    })

    const params = {
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

    const outboundPackage = await this.packMessage(agentContext, { message, params, endpoint: service.serviceEndpoint })
    outboundPackage.endpoint = service.serviceEndpoint
    outboundPackage.connectionId = connection?.id
    for (const transport of this.outboundTransports) {
      const protocolScheme = getProtocolScheme(service.serviceEndpoint)
      if (!protocolScheme) {
        this.logger.warn('Service does not have a protocol scheme.')
      } else if (transport.supportedSchemes.includes(protocolScheme)) {
        await transport.sendMessage(outboundPackage)
        return
      }
    }
    throw new MessageSendingError(`Unable to send message to service: ${service.serviceEndpoint}`, {
      outboundMessageContext,
    })
  }

  private findSessionForOutboundContext(outboundContext: OutboundMessageContext) {
    let session: TransportSession | undefined = undefined

    // Use session id from outbound context if present, or use the session from the inbound message context
    const sessionId = outboundContext.sessionId ?? outboundContext.inboundMessageContext?.sessionId

    // Try to find session by id
    if (sessionId) {
      session = this.transportService.findSessionById(sessionId)
    }

    // Try to find session by connection id
    if (!session && outboundContext.connection?.id) {
      session = this.transportService.findSessionByConnectionId(outboundContext.connection.id)
    }

    return session && session.inboundMessage?.hasAnyReturnRoute() ? session : null
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
        const services = outOfBand.outOfBandInvitation?.getServices() || []
        for (const service of services) {
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

  private emitMessageSentEvent(outboundMessageContext: OutboundMessageContext, status: OutboundMessageSendStatus) {
    const { agentContext } = outboundMessageContext
    this.eventEmitter.emit<AgentMessageSentEvent>(agentContext, {
      type: AgentEventTypes.AgentMessageSent,
      payload: {
        message: outboundMessageContext,
        status,
      },
    })
  }

  private async sendDIDCommV2Message(
    outboundMessageContext: OutboundMessageContext,
    options?: {
      transportPriority?: TransportPriorityOptions
    }
  ) {
    const { agentContext } = outboundMessageContext
    const message = outboundMessageContext.message as DidCommV2Message

    const recipient = message.firstRecipient
    if (!recipient) {
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      this.logger.error(`Unable to send message. Message doesn't sender DID.`)
      throw new AriesFrameworkError(`Unable to send message. Message doesn't contain recipient DID.`)
    }
    if (!message.from) {
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      this.logger.error(`Unable to send message. Message doesn't sender DID.`)
      throw new AriesFrameworkError(`Unable to send message. Message doesn't sender DID.`)
    }

    const { didDocument: senderDidDoc } = await this.didResolverService.resolve(agentContext, message.from)
    if (!senderDidDoc) {
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      this.logger.error(`Unable to resolve did document for did '${message.from}'`)
      throw new AriesFrameworkError(`Unable to resolve did document for did '${message.from}'`)
    }

    const { didDocument: recipientDidDoc } = await this.didResolverService.resolve(agentContext, recipient)
    if (!recipientDidDoc) {
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      this.logger.error(`Unable to resolve did document for did '${recipient}'`)
      throw new AriesFrameworkError(`Unable to resolve did document for did '${recipient}'`)
    }

    // find service transport supported for both sender and receiver
    const services = this.findCommonSupportedDidCommV2Services(
      senderDidDoc,
      recipientDidDoc,
      options?.transportPriority
    )
    if (!services) {
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      this.logger.error(
        `Unable to send message ${message.id} because there is no any commonly supported service between sender and recipient`
      )
      throw new AriesFrameworkError(
        `Unable to send message ${message.id} because there is no any commonly supported service between sender and recipient`
      )
    }

    // pack and send message until first success
    for (const service of services) {
      try {
        this.logger.info(
          `Sending message with id: ${message.id} to ${service.serviceEndpoint}. Transport ${service.protocolScheme}`
        )
        const params: DidCommV2PackMessageParams = {
          recipientDidDoc,
          senderDidDoc,
          service,
        }
        const payload = await this.envelopeService.packMessage(agentContext, message, params)

        const outboundPackage = {
          payload,
          endpoint: service.serviceEndpoint,
        }
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
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToTransport)
        this.logger.info(
          `Message with id: ${message.id} sent to ${service.serviceEndpoint}. Transport ${service.protocolScheme}`
        )
        return
      } catch (error) {
        this.logger.warn(
          `Unable to send message with id: ${message.id} to ${service.serviceEndpoint}. Transport failure `,
          {
            errors: error,
          }
        )
        // ignore and try another transport
      }
    }
    this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
    this.logger.error(`Unable to send message ${message.id} through any commonly supported transport.`)
    throw new AriesFrameworkError(`Unable to send message ${message.id} through any commonly supported transport.`)
  }

  private findCommonSupportedDidCommV2Services(
    senderDidDocument: DidDocument,
    recipientDidDocument: DidDocument,
    transportPriority?: TransportPriorityOptions
  ): DidCommV2Service[] {
    const senderServices = senderDidDocument?.service || []
    const recipientServices = recipientDidDocument?.service || []
    let services = recipientServices.filter((recipientService) => {
      return senderServices.find((senderService) => {
        const service = senderService as DidCommV2Service
        return (
          senderService.protocolScheme === recipientService.protocolScheme &&
          senderService.type === DidCommV2Service.type &&
          (!service.accept?.length || service.accept.includes('didcomm/v2'))
        )
      })
    })
    // If transport priority is set we will sort services by our priority
    if (transportPriority?.schemes) {
      services = services.sort(function (a, b) {
        const aScheme = getProtocolScheme(a.serviceEndpoint)
        const bScheme = getProtocolScheme(b.serviceEndpoint)
        return transportPriority?.schemes.indexOf(aScheme) - transportPriority?.schemes.indexOf(bScheme)
      })
    }
    return services
  }
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}
