import {
  AgentContext,
  CredoError,
  DidKey,
  DidsApi,
  NewDidCommV2Service,
  didKeyToEd25519PublicJwk,
  didToNumAlgo2DidDocument,
  didToNumAlgo4DidDocument,
  EventEmitter,
  getPublicJwkFromVerificationMethod,
  injectable,
  Kms,
  MessageValidator,
  type ResolvedDidCommService,
  utils,
  verkeyToDidKey,
} from '@credo-ts/core'
import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import type { EnvelopeKeys } from './DidCommEnvelopeService'
import { DidCommEnvelopeService } from './DidCommEnvelopeService'
import { buildV2PlaintextFromMessage } from './v2'
import { DidCommV2EnvelopeService } from './v2'
import type { DidCommMessageSentEvent } from './DidCommEvents'
import { DidCommEventTypes } from './DidCommEvents'
import type { DidCommMessage } from './DidCommMessage'
import { DidCommModuleConfig } from './DidCommModuleConfig'
import type { DidCommTransportSession } from './DidCommTransportService'
import { DidCommTransportService } from './DidCommTransportService'
import { ReturnRouteTypes } from './decorators/transport/TransportDecorator'
import { MessageSendingError } from './errors'
import { DidCommOutboundMessageContext, OutboundMessageSendStatus } from './models'
import type { DidCommConnectionRecord } from './modules/connections/repository'
import { toX25519 } from './modules/connections/services/helpers'
import { DidCommOutOfBandRepository } from './modules/oob/repository'
import type { DidCommOutOfBandRecord } from './modules/oob/repository'
import { DidCommDocumentService } from './services/DidCommDocumentService'
import type { DidCommEncryptedMessage, DidCommOutboundPackage } from './types'

export interface TransportPriorityOptions {
  schemes: string[]
  restrictive?: boolean
}

@injectable()
export class DidCommMessageSender {
  private envelopeService: DidCommEnvelopeService
  private v2EnvelopeService: DidCommV2EnvelopeService
  private transportService: DidCommTransportService
  private didCommModuleConfig: DidCommModuleConfig
  private didCommDocumentService: DidCommDocumentService
  private eventEmitter: EventEmitter

  public constructor(
    envelopeService: DidCommEnvelopeService,
    v2EnvelopeService: DidCommV2EnvelopeService,
    transportService: DidCommTransportService,
    didCommModuleConfig: DidCommModuleConfig,
    didCommDocumentService: DidCommDocumentService,
    eventEmitter: EventEmitter
  ) {
    this.envelopeService = envelopeService
    this.v2EnvelopeService = v2EnvelopeService
    this.transportService = transportService
    this.didCommModuleConfig = didCommModuleConfig
    this.didCommDocumentService = didCommDocumentService
    this.eventEmitter = eventEmitter
  }

  public async packMessage(
    agentContext: AgentContext,
    {
      keys,
      message,
      endpoint,
      connection,
    }: {
      keys: EnvelopeKeys
      message: DidCommMessage
      endpoint: string
      connection?: DidCommConnectionRecord
    }
  ): Promise<DidCommOutboundPackage> {
    let encryptedMessage: DidCommEncryptedMessage
    // Connection request/response: use v1 so recipient can decrypt (v1 authcrypt embeds sender key; v2 requires skid resolution which fails for did:peer:1 before connection).
    const isConnectionRequest = typeof message.type === 'string' && message.type.endsWith('connections/1.0/request')
    const isConnectionResponse = typeof message.type === 'string' && message.type.endsWith('connections/1.0/response')
    const useV1ForConnection = isConnectionRequest || isConnectionResponse

    if (
      !useV1ForConnection &&
      this.didCommModuleConfig.sendDidCommV2 &&
      keys.recipientKeys.length >= 1 &&
      keys.routingKeys.length === 0 &&
      keys.senderKey
    ) {
      try {
        const recipientX25519 = toX25519(keys.recipientKeys[0])
        recipientX25519.keyId = keys.recipientKeys[0].hasKeyId ? keys.recipientKeys[0].keyId : keys.recipientKeys[0].legacyKeyId
        const senderX25519 = toX25519(keys.senderKey)
        senderX25519.keyId = keys.senderKey.hasKeyId ? keys.senderKey.keyId : keys.senderKey.legacyKeyId
        const plaintext = buildV2PlaintextFromMessage(message, {
          useDidSovPrefixWhereAllowed: this.didCommModuleConfig.useDidSovPrefixWhereAllowed,
          ...(connection?.did && connection?.theirDid
            ? { from: connection.did, to: [connection.theirDid] }
            : undefined),
        })
        agentContext.config.logger.debug('Raw DIDComm v2 plaintext (on-wire format, before encrypt)', {
          id: plaintext.id,
          type: plaintext.type,
          from: plaintext.from,
          to: plaintext.to,
          thid: plaintext.thid,
          bodyKeys: plaintext.body ? Object.keys(plaintext.body) : undefined,
        })
        encryptedMessage = await this.v2EnvelopeService.pack(agentContext, plaintext, {
          recipientKey: recipientX25519,
          senderKey: senderX25519,
          senderKeySkid: keys.senderKeySkid,
        })
      } catch (error) {
        agentContext.config.logger.debug('DIDComm v2 authcrypt pack failed, falling back to v1', { error })
        encryptedMessage = await this.envelopeService.packMessage(agentContext, message, keys)
      }
    } else {
      encryptedMessage = await this.envelopeService.packMessage(agentContext, message, keys)
    }

    return {
      payload: encryptedMessage,
      responseRequested: message.hasAnyReturnRoute(),
      endpoint,
    }
  }

  private async sendMessageToSession(
    agentContext: AgentContext,
    session: DidCommTransportSession,
    message: DidCommMessage,
    connection?: DidCommConnectionRecord
  ) {
    agentContext.config.logger.debug(`Packing message and sending it via existing session ${session.type}...`)
    if (!session.keys) {
      throw new CredoError(`There are no keys for the given ${session.type} transport session.`)
    }
    const { keys } = session
    let encryptedMessage: DidCommEncryptedMessage
    const isConnectionRequestSession =
      typeof message.type === 'string' && message.type.endsWith('connections/1.0/request')
    const isConnectionResponseSession =
      typeof message.type === 'string' && message.type.endsWith('connections/1.0/response')
    const useV1ForConnectionSession = isConnectionRequestSession || isConnectionResponseSession

    if (
      !useV1ForConnectionSession &&
      this.didCommModuleConfig.sendDidCommV2 &&
      keys.recipientKeys.length >= 1 &&
      keys.routingKeys.length === 0 &&
      keys.senderKey
    ) {
      try {
        const recipientX25519 = toX25519(keys.recipientKeys[0])
        // Use did:key as kid so recipient can resolve via tryParseKidAsPublicJwk (connectionless return route)
        recipientX25519.keyId = new DidKey(keys.recipientKeys[0]).did
        const senderX25519 = toX25519(keys.senderKey)
        senderX25519.keyId = keys.senderKey.hasKeyId ? keys.senderKey.keyId : keys.senderKey.legacyKeyId
        const plaintext = buildV2PlaintextFromMessage(message, {
          useDidSovPrefixWhereAllowed: this.didCommModuleConfig.useDidSovPrefixWhereAllowed,
          ...(connection?.did && connection?.theirDid
            ? { from: connection.did, to: [connection.theirDid] }
            : undefined),
        })
        agentContext.config.logger.debug('Raw DIDComm v2 plaintext (on-wire format, before encrypt)', {
          id: plaintext.id,
          type: plaintext.type,
          from: plaintext.from,
          to: plaintext.to,
          thid: plaintext.thid,
          bodyKeys: plaintext.body ? Object.keys(plaintext.body) : undefined,
        })
        encryptedMessage = await this.v2EnvelopeService.pack(agentContext, plaintext, {
          recipientKey: recipientX25519,
          senderKey: senderX25519,
          senderKeySkid: keys.senderKeySkid,
        })
      } catch (error) {
        agentContext.config.logger.debug('DIDComm v2 authcrypt pack failed, falling back to v1', { error })
        encryptedMessage = await this.envelopeService.packMessage(agentContext, message, session.keys)
      }
    } else {
      encryptedMessage = await this.envelopeService.packMessage(agentContext, message, session.keys)
    }
    agentContext.config.logger.debug('Sending message')
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
      connection: DidCommConnectionRecord
      recipientKey: string
      encryptedMessage: DidCommEncryptedMessage
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
        agentContext.config.logger.debug(
          `Sending packed message via session failed with error: ${error.message}.`,
          error
        )
      }
    }

    // Retrieve DIDComm services
    const { services, queueService } = await this.retrieveServicesByConnection(
      agentContext,
      connection,
      options?.transportPriority
    )

    if (this.didCommModuleConfig.outboundTransports.length === 0 && !queueService) {
      throw new CredoError('Agent has no outbound transport!')
    }

    // Loop trough all available services and try to send the message
    for (const service of services) {
      agentContext.config.logger.debug('Sending outbound message to service:', { service })
      try {
        const protocolScheme = utils.getProtocolScheme(service.serviceEndpoint)
        for (const transport of this.didCommModuleConfig.outboundTransports) {
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
        agentContext.config.logger.debug(
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
      agentContext.config.logger.debug(
        `Queue packed message for connection ${connection.id} (${connection.theirLabel})`
      )
      await this.didCommModuleConfig.queueTransportRepository.addMessage(agentContext, {
        connectionId: connection.id,
        recipientDids: [verkeyToDidKey(recipientKey)],
        payload: encryptedMessage,
      })
      return
    }

    // Message is undeliverable
    agentContext.config.logger.error(
      `Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`,
      {
        message: encryptedMessage,
        errors,
        connection,
      }
    )
    throw new CredoError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  public async sendMessage(
    outboundMessageContext: DidCommOutboundMessageContext,
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
      agentContext.config.logger.error('Outbound message has no associated connection')
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError('Outbound message has no associated connection', {
        outboundMessageContext,
      })
    }

    agentContext.config.logger.debug('Send outbound message', {
      message,
      connectionId: connection.id,
    })

    const session = this.findSessionForOutboundContext(outboundMessageContext)

    if (session) {
      agentContext.config.logger.debug(
        `Found session with return routing for message '${message.id}' (connection '${connection.id}'`
      )

      try {
        await this.sendMessageToSession(agentContext, session, message, connection)
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToSession)
        return
      } catch (error) {
        errors.push(error)
        agentContext.config.logger.debug(
          `Sending an outbound message via session failed with error: ${error.message}.`,
          error
        )
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
      agentContext.config.logger.error(`Unable to retrieve services for connection '${connection.id}. ${error.message}`)
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError(`Unable to retrieve services for connection '${connection.id}`, {
        outboundMessageContext,
        cause: error,
      })
    }

    if (!connection.did) {
      agentContext.config.logger.error(
        `Unable to send message using connection '${connection.id}' that doesn't have a did`
      )
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)
      throw new MessageSendingError(
        `Unable to send message using connection '${connection.id}' that doesn't have a did`,
        { outboundMessageContext }
      )
    }

    const dids = agentContext.resolve(DidsApi)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(connection.did).catch((error) => {
      agentContext.config.logger.error(
        `Unable to send message using connection '${connection.id}', unable to resolve did`,
        {
          error,
        }
      )
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
    for (const service of services) {
      try {
        // Enable return routing if the our did document does not have any inbound endpoint for given sender key
        await this.sendToService(
          new DidCommOutboundMessageContext(message, {
            agentContext,
            serviceParams: {
              service,
              senderKey: senderVerificationMethod.publicJwk,
              returnRoute: shouldAddReturnRoute,
              senderKeySkid: (() => {
                const id = senderVerificationMethod.verificationMethod.id
                if (typeof id !== 'string') return undefined
                if (id.startsWith('did:')) return id
                if (id.startsWith('#')) return `${didDocument.id}${id}`
                return undefined
              })(),
            },
            connection,
          })
        )
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToTransport)
        return
      } catch (error) {
        errors.push(error)
        agentContext.config.logger.debug(
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
      agentContext.config.logger.debug(`Queue message for connection ${connection.id} (${connection.theirLabel})`)

      const keys = {
        recipientKeys: queueService.recipientKeys,
        routingKeys: queueService.routingKeys,
        senderKey: senderVerificationMethod.publicJwk,
      }

      const encryptedMessage = await this.envelopeService.packMessage(agentContext, message, keys)
      await this.didCommModuleConfig.queueTransportRepository.addMessage(agentContext, {
        connectionId: connection.id,
        recipientDids: keys.recipientKeys.map((item) => new DidKey(item).did),
        payload: encryptedMessage,
      })

      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.QueuedForPickup)

      return
    }

    // Message is undeliverable
    agentContext.config.logger.error(
      `Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`,
      {
        message,
        errors,
        connection,
      }
    )
    this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.Undeliverable)

    throw new MessageSendingError(
      `Message is undeliverable to connection ${connection.id} (${connection.theirLabel}). \n\nReasons:\n\t- ${errors.map((e) => e.message).join('\n\t-')}`,
      { outboundMessageContext }
    )
  }

  private async sendMessageToService(outboundMessageContext: DidCommOutboundMessageContext) {
    const session = this.findSessionForOutboundContext(outboundMessageContext)

    if (session) {
      outboundMessageContext.agentContext.config.logger.debug(
        `Found session with return routing for message '${outboundMessageContext.message.id}'`
      )
      try {
        await this.sendMessageToSession(outboundMessageContext.agentContext, session, outboundMessageContext.message)
        this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToSession)
        return
      } catch (error) {
        outboundMessageContext.agentContext.config.logger.debug(
          `Sending an outbound message via session failed with error: ${error.message}.`,
          error
        )
      }
    }

    // If there is no session try sending to service instead
    try {
      await this.sendToService(outboundMessageContext)
      this.emitMessageSentEvent(outboundMessageContext, OutboundMessageSendStatus.SentToTransport)
    } catch (error) {
      outboundMessageContext.agentContext.config.logger.error(
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

  private async sendToService(outboundMessageContext: DidCommOutboundMessageContext) {
    const { agentContext, message, serviceParams, connection } = outboundMessageContext

    if (!serviceParams) {
      throw new CredoError('No service parameters found in outbound message context')
    }
    const { service, senderKey, returnRoute } = serviceParams

    if (this.didCommModuleConfig.outboundTransports.length === 0) {
      throw new CredoError('Agent has no outbound transport!')
    }

    agentContext.config.logger.debug('Sending outbound message to service:', {
      messageId: message.id,
      service: { ...service, recipientKeys: 'omitted...', routingKeys: 'omitted...' },
    })

    // For connectionless v2: use did:key as kid so recipient can resolve via tryParseKidAsPublicJwk
    const recipientKeys =
      !connection && this.didCommModuleConfig.sendDidCommV2
        ? service.recipientKeys.map((k) => {
            const copy = Kms.PublicJwk.fromPublicJwk(k.toJson())
            copy.keyId = new DidKey(k).did
            return copy
          })
        : service.recipientKeys

    const keys = {
      recipientKeys,
      routingKeys: service.routingKeys,
      senderKey,
      senderKeySkid: serviceParams.senderKeySkid,
    }

    // Set return routing for message if requested
    if (returnRoute) {
      message.setReturnRouting(ReturnRouteTypes.all)
    }

    try {
      MessageValidator.validateSync(message)
    } catch (error) {
      agentContext.config.logger.error(
        `Aborting sending outbound message ${message.type} to ${service.serviceEndpoint}. Message validation failed`,
        {
          errors: error,
          message: message.toJSON(),
        }
      )

      throw error
    }

    const outboundPackage = await this.packMessage(agentContext, {
      message,
      keys,
      endpoint: service.serviceEndpoint,
      connection,
    })
    outboundPackage.endpoint = service.serviceEndpoint
    outboundPackage.connectionId = connection?.id
    for (const transport of this.didCommModuleConfig.outboundTransports) {
      const protocolScheme = utils.getProtocolScheme(service.serviceEndpoint)
      if (!protocolScheme) {
        agentContext.config.logger.warn('Service does not have a protocol scheme.')
      } else if (transport.supportedSchemes.includes(protocolScheme)) {
        await transport.sendMessage(outboundPackage)
        return
      }
    }
    throw new MessageSendingError(`Unable to send message to service: ${service.serviceEndpoint}`, {
      outboundMessageContext,
    })
  }

  private findSessionForOutboundContext(outboundContext: DidCommOutboundMessageContext) {
    let session: DidCommTransportSession | undefined

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
    connection: DidCommConnectionRecord,
    transportPriority?: TransportPriorityOptions,
    outOfBand?: DidCommOutOfBandRecord
  ) {
    agentContext.config.logger.debug(
      `Retrieving services for connection '${connection.id}' (${connection.theirLabel})`,
      {
        transportPriority,
        connection,
      }
    )

    let didCommServices: ResolvedDidCommService[] = []

    if (connection.theirDid) {
      agentContext.config.logger.debug(`Resolving services for connection theirDid ${connection.theirDid}.`)
      try {
        didCommServices = await this.didCommDocumentService.resolveServicesFromDid(agentContext, connection.theirDid)
      } catch {
        // did:peer:1 may not yet be resolvable (e.g. immediately after connection response)
        didCommServices = []
      }

      // Fallback (e.g. v2 OOB): resolveServicesFromDid may return [] or services with empty recipientKeys
      // for did:peer:2/4; parse peer DID directly to extract keys.
      // Applies to both requester and responder since v2 OOB invitations use services: [from] (DID string),
      // so getInlineServices() is empty and the requester cannot use inline services.
      const hasNoUsableRecipientKeys =
        didCommServices.length === 0 ||
        didCommServices.every((s) => !s.recipientKeys || s.recipientKeys.length === 0)
      const isPeer2 = connection.theirDid?.startsWith('did:peer:2')
      const isPeer4LongForm =
        connection.theirDid?.startsWith('did:peer:4') && connection.theirDid?.includes(':')
      if (hasNoUsableRecipientKeys && connection.outOfBandId && (isPeer2 || isPeer4LongForm)) {
        if (didCommServices.length > 0) {
          didCommServices = []
        }
        try {
          const didDocument = isPeer2
            ? didToNumAlgo2DidDocument(connection.theirDid!)
            : didToNumAlgo4DidDocument(connection.theirDid!)
          const allServices = didDocument.service ?? []
          for (const svc of allServices) {
            const endpoint =
              'firstServiceEndpointUri' in svc
                ? (svc as NewDidCommV2Service).firstServiceEndpointUri
                : typeof svc.serviceEndpoint === 'string'
                  ? svc.serviceEndpoint
                  : (svc.serviceEndpoint as { uri?: string })?.uri
            if (endpoint) {
              // Use keyAgreement (X25519 for v2) and authentication (Ed25519 for v1 fallback)
              const recipientKeys: Kms.PublicJwk[] = []
              // authentication (Ed25519) first - v2 converts to X25519; v1 uses Ed25519 directly
              const keyRefs = [
                ...(didDocument.authentication ?? []),
                ...(didDocument.keyAgreement ?? []),
              ]
              const seen = new Set<string>()
              for (const keyRef of keyRefs) {
                const verificationMethod =
                  typeof keyRef === 'string'
                    ? didDocument.dereferenceVerificationMethod(keyRef)
                    : keyRef
                if (seen.has(verificationMethod.id)) continue
                const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
                if (publicJwk.is(Kms.Ed25519PublicJwk) || publicJwk.is(Kms.X25519PublicJwk)) {
                  seen.add(verificationMethod.id)
                  const jwk = publicJwk
                  if (verificationMethod?.id && !jwk.hasKeyId) {
                    jwk.keyId = verificationMethod.id
                  }
                  recipientKeys.push(jwk)
                }
              }
              didCommServices.push({
                id: svc.id,
                recipientKeys: recipientKeys as Kms.PublicJwk<Kms.Ed25519PublicJwk>[],
                routingKeys: [],
                serviceEndpoint: endpoint,
              })
            }
          }
          if (didCommServices.length > 0) {
            agentContext.config.logger.debug(
              `Used did:peer:2/4 parse fallback for connection ${connection.id}.`
            )
          }
        } catch (err) {
          agentContext.config.logger.debug(
            `did:peer:2/4 parse fallback failed for ${connection.id}: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }

      // Fallback: did:peer:1 may not yet be resolvable; use invitation creator's inline services from OOB record when we're the requester
      if (didCommServices.length === 0 && connection.outOfBandId && connection.isRequester) {
        try {
          const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
          const oobRecord = await outOfBandRepository.findById(agentContext, connection.outOfBandId)
          if (oobRecord) {
            agentContext.config.logger.debug(
              `Using OOB invitation services as fallback for connection ${connection.id} (theirDid not yet resolvable).`
            )
            for (const service of oobRecord.outOfBandInvitation.getInlineServices()) {
              didCommServices.push({
                id: service.id,
                recipientKeys: service.recipientKeys.map(didKeyToEd25519PublicJwk),
                routingKeys: service.routingKeys?.map(didKeyToEd25519PublicJwk) || [],
                serviceEndpoint: service.serviceEndpoint,
              })
            }
          }
        } catch {
          // Ignore: proceed with empty services
        }
      }
    } else if (outOfBand) {
      agentContext.config.logger.debug(`Resolving services from out-of-band record ${outOfBand.id}.`)
      if (connection.isRequester) {
        for (const service of outOfBand.outOfBandInvitation.getServices()) {
          // Resolve dids to DIDDocs to retrieve services
          if (typeof service === 'string') {
            agentContext.config.logger.debug(`Resolving services for did ${service}.`)
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
    } else if (connection.outOfBandId && connection.isRequester) {
      // theirDid may be null (e.g. before response processed, or race); use OOB invitation services
      try {
        const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
        const oobRecord = await outOfBandRepository.findById(agentContext, connection.outOfBandId)
        if (oobRecord) {
          agentContext.config.logger.debug(
            `Resolving services from connection outOfBandId ${connection.outOfBandId}.`
          )
          for (const service of oobRecord.outOfBandInvitation.getInlineServices()) {
            didCommServices.push({
              id: service.id,
              recipientKeys: service.recipientKeys.map(didKeyToEd25519PublicJwk),
              routingKeys: service.routingKeys?.map(didKeyToEd25519PublicJwk) || [],
              serviceEndpoint: service.serviceEndpoint,
            })
          }
        }
      } catch {
        // Ignore
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

    agentContext.config.logger.debug(
      `Retrieved ${services.length} services for message to connection '${connection.id}'(${connection.theirLabel})'`,
      { hasQueueService: queueService !== undefined, transportPriority }
    )
    return { services, queueService }
  }

  private emitMessageSentEvent(
    outboundMessageContext: DidCommOutboundMessageContext,
    status: OutboundMessageSendStatus
  ) {
    const { agentContext } = outboundMessageContext
    this.eventEmitter.emit<DidCommMessageSentEvent>(agentContext, {
      type: DidCommEventTypes.DidCommMessageSent,
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
