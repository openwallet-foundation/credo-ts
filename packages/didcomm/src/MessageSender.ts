import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'
import type { AgentMessageSentEvent } from './Events'
import type { TransportSession } from './TransportService'
import type { ConnectionRecord } from './modules/connections/repository'
import type { OutOfBandRecord } from './modules/oob/repository'
import type { OutboundTransport } from './transport/OutboundTransport'
import type { EncryptedMessage, OutboundPackage } from './types'

import {
  AgentContext,
  CredoError,
  DidKey,
  DidsApi,
  EventEmitter,
  InjectionSymbols,
  Kms,
  Logger,
  MessageValidator,
  ResolvedDidCommService,
  didKeyToEd25519PublicJwk,
  getPublicJwkFromVerificationMethod,
  inject,
  injectable,
  utils,
  verkeyToDidKey,
} from '@credo-ts/core'

import { EnvelopeService } from './EnvelopeService'
import { AgentEventTypes } from './Events'
import { TransportService } from './TransportService'
import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import { ReturnRouteTypes } from './decorators/transport/TransportDecorator'
import { MessageSendingError } from './errors'
import { OutboundMessageContext, OutboundMessageSendStatus } from './models'
import { MessagePickupRepository } from './modules/message-pickup/storage'
import { DidCommDocumentService } from './services/DidCommDocumentService'

export interface TransportPriorityOptions {
  schemes: string[]
  restrictive?: boolean
}

@injectable()
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messagePickupRepository: MessagePickupRepository
  private logger: Logger
  private didCommDocumentService: DidCommDocumentService
  private eventEmitter: EventEmitter
  private _outboundTransports: OutboundTransport[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessagePickupRepository) messagePickupRepository: MessagePickupRepository,
    @inject(InjectionSymbols.Logger) logger: Logger,
    didCommDocumentService: DidCommDocumentService,
    eventEmitter: EventEmitter
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messagePickupRepository = messagePickupRepository
    this.logger = logger
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

  public async packMessage(
    agentContext: AgentContext,
    {
      keys,
      message,
      endpoint,
    }: {
      keys: EnvelopeKeys
      message: AgentMessage
      endpoint: string
    }
  ): Promise<OutboundPackage> {
    const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, keys)

    return {
      payload: encryptedMessage,
      responseRequested: message.hasAnyReturnRoute(),
      endpoint,
    }
  }

  private async sendMessageToSession(agentContext: AgentContext, session: TransportSession, message: AgentMessage) {
    this.logger.debug(`Packing message and sending it via existing session ${session.type}...`)
    if (!session.keys) {
      throw new CredoError(`There are no keys for the given ${session.type} transport session.`)
    }
    const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, session.keys)
    this.logger.debug('Sending message')
    await session.send(agentContext, encryptedMessage)
  }

  public async sendPackage(
    agentContext: AgentContext,
    {
      connection,
      encryptedMessage,
      recipientKey,
      options,
    }: {
      connection: ConnectionRecord
      recipientKey: string
      encryptedMessage: EncryptedMessage
      options?: { transportPriority?: TransportPriorityOptions }
    }
  ) {
    const errors: Error[] = []

    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting()) {
      try {
        await session.send(agentContext, encryptedMessage)
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
      throw new CredoError('Agent has no outbound transport!')
    }

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      this.logger.debug('Sending outbound message to service:', { service })
      try {
        const protocolScheme = utils.getProtocolScheme(service.serviceEndpoint)
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
      await this.messagePickupRepository.addMessage({
        connectionId: connection.id,
        recipientDids: [verkeyToDidKey(recipientKey)],
        payload: encryptedMessage,
      })
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: encryptedMessage,
      errors,
      connection,
    })
    throw new CredoError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  public async sendMessage(
    outboundMessageContext: OutboundMessageContext,
    options?: {
      transportPriority?: TransportPriorityOptions
    }
  ) {
    const { agentContext, connection, outOfBand, message } = outboundMessageContext
    const errors: Error[] = []

    if (outboundMessageContext.isOutboundServiceMessage()) {
      return this.sendMessageToService(outboundMessageContext)
    }

    if (!connection) {
      this.logger.error('Outbound message has no associated connection')
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError('Outbound message has no associated connection', {
        outboundMessageContext,
      })
    }

    this.logger.debug('Send outbound message', {
      message,
      connectionId: connection.id,
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

    const dids = agentContext.resolve(DidsApi)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(connection.did).catch((error) => {
      this.logger.error(`Unable to send message using connection '${connection.id}', unable to resolve did`, {
        error,
      })
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError(
        `Unable to send message using connection '${connection.id}'. Unble to resolve did`,
        { outboundMessageContext, cause: error }
      )
    })

    const authentication = didDocument.authentication
      ?.map((a) => {
        const verificationMethod = typeof a === 'string' ? didDocument.dereferenceVerificationMethod(a) : a
        const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
        const kmsKeyId = keys?.find((key) => verificationMethod.id.endsWith(key.didDocumentRelativeKeyId))?.kmsKeyId

        // Set stored key id, or fallback to legacy key id
        publicJwk.keyId = kmsKeyId ?? publicJwk.legacyKeyId

        return { verificationMethod, publicJwk, kmsKeyId }
      })
      .filter((v): v is typeof v & { publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk> } =>
        v.publicJwk.is(Kms.Ed25519PublicJwk)
      )

    // We take the first one with a kms key id. Otherwise we pick the first
    const senderVerificationMethod = authentication?.find((a) => a.kmsKeyId !== undefined) ?? authentication?.[0]
    if (!senderVerificationMethod) {
      throw new MessageSendingError(
        `Unable to determine sender key for did ${connection.did}, no available Ed25519 keys`,
        {
          outboundMessageContext,
        }
      )
    }

    // If the returnRoute is already set we won't override it. This allows to set the returnRoute manually if this is desired.
    const shouldAddReturnRoute =
      message.transport?.returnRoute === undefined && !this.transportService.hasInboundEndpoint(didDocument)

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      try {
        // Enable return routing if the our did document does not have any inbound endpoint for given sender key
        await this.sendToService(
          new OutboundMessageContext(message, {
            agentContext,
            serviceParams: {
              service,
              senderKey: senderVerificationMethod.publicJwk,
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
    if (queueService && message.allowQueueTransport) {
      this.logger.debug(`Queue message for connection ${connection.id} (${connection.theirLabel})`)

      const keys = {
        recipientKeys: queueService.recipientKeys,
        routingKeys: queueService.routingKeys,
        senderKey: senderVerificationMethod.publicJwk,
      }

      const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, keys)
      await this.messagePickupRepository.addMessage({
        connectionId: connection.id,
        recipientDids: keys.recipientKeys.map((item) => new DidKey(item).did),
        payload: encryptedMessage,
      })

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

  private async sendMessageToService(outboundMessageContext: OutboundMessageContext) {
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
      throw new CredoError('No service parameters found in outbound message context')
    }
    const { service, senderKey, returnRoute } = serviceParams

    if (this.outboundTransports.length === 0) {
      throw new CredoError('Agent has no outbound transport!')
    }

    this.logger.debug('Sending outbound message to service:', {
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
    outboundPackage.connectionId = connection?.id
    for (const transport of this.outboundTransports) {
      const protocolScheme = utils.getProtocolScheme(service.serviceEndpoint)
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

    return session?.inboundMessage?.hasAnyReturnRoute() ? session : null
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
              recipientKeys: service.recipientKeys.map(didKeyToEd25519PublicJwk),
              routingKeys: service.routingKeys?.map(didKeyToEd25519PublicJwk) || [],
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
        const serviceSchema = utils.getProtocolScheme(service.serviceEndpoint)
        return transportPriority.schemes.includes(serviceSchema)
      })
    }

    // If transport priority is set we will sort services by our priority
    if (transportPriority?.schemes) {
      services = services.sort((a, b) => {
        const aScheme = utils.getProtocolScheme(a.serviceEndpoint)
        const bScheme = utils.getProtocolScheme(b.serviceEndpoint)
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
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}
