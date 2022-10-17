import type { ConnectionRecord } from '../modules/connections'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { DidDocumentService } from '../modules/dids/domain/service'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { AcceptProtocol, Transports } from '../modules/routing/types'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type {
  OutboundMessage,
  OutboundPackage,
  OutboundPackagePayload,
  SendMessageOptions,
  TransportPriorityOptions,
} from '../types'
import type { TransportSession } from './TransportService'
import type { DIDCommMessage, EncryptedMessage, DIDCommV1Message } from './didcomm'
import type { PackMessageParams } from './didcomm/EnvelopeService'

import { inject, injectable } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { LogContexts, Logger } from '../logger'
import { DidCommDocumentService } from '../modules/didcomm/services/DidCommDocumentService'
import { DidDocument } from '../modules/dids/domain/DidDocument'
import { getKeyDidMappingByVerificationMethod } from '../modules/dids/domain/key-type'
import { DidCommV2Service } from '../modules/dids/domain/service'
import { didKeyToInstanceOfKey } from '../modules/dids/helpers'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { OutOfBandRepository } from '../modules/oob/repository'
import { ForwardMessageV2 } from '../modules/routing/messages'
import { MessageRepository } from '../storage/MessageRepository'
import { MessageValidator } from '../utils/MessageValidator'
import { getProtocolScheme } from '../utils/uri'
import { uuid } from '../utils/uuid'

import { AgentConfig } from './AgentConfig'
import { TransportService } from './TransportService'
import { DIDCommV2Message } from './didcomm'
import { EnvelopeService } from './didcomm/EnvelopeService'
import { DIDCommVersion, SendingMessageType } from './didcomm/types'

@injectable()
export class MessageSender {
  private agentConfig: AgentConfig
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private didResolverService: DidResolverService
  private didCommDocumentService: DidCommDocumentService
  private outOfBandRepository: OutOfBandRepository
  public readonly outboundTransports: OutboundTransport[] = []

  public constructor(
    agentConfig: AgentConfig,
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger,
    didResolverService: DidResolverService,
    didCommDocumentService: DidCommDocumentService,
    outOfBandRepository: OutOfBandRepository
  ) {
    this.agentConfig = agentConfig
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
    this.didResolverService = didResolverService
    this.didCommDocumentService = didCommDocumentService
    this.outOfBandRepository = outOfBandRepository
    this.outboundTransports = []
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this.outboundTransports.push(outboundTransport)
  }

  public async packMessage({
    connection,
    senderKey,
    service,
    message,
  }: {
    connection?: ConnectionRecord
    senderKey?: string
    accept?: AcceptProtocol[]
    service?: ResolvedDidCommService
    message: DIDCommMessage
  }): Promise<OutboundPackage> {
    let params: PackMessageParams

    if (message.version === DIDCommVersion.V2) {
      if (!connection || !connection.theirDid) {
        throw new AriesFrameworkError(`There are no connection passed to pack message`)
      }
      params = {
        toDID: connection?.theirDid,
        fromDID: connection?.did,
      }
    } else {
      if (!service) {
        throw new AriesFrameworkError(`There are no Service passed to pack message for`)
      }
      if (!service.recipientKeys.length) {
        throw new AriesFrameworkError('Service does not contain any recipient!')
      }
      params = {
        recipientKeys: service.recipientKeys.map((key) => key.publicKeyBase58),
        routingKeys: service.routingKeys.map((key) => key.publicKeyBase58) || [],
        senderKey: senderKey || null,
      }
    }
    const encryptedMessage = await this.envelopeService.packMessageEncrypted(message, params)
    return {
      payload: encryptedMessage,
      responseRequested: message.hasAnyReturnRoute(),
    }
  }

  private async sendMessageToSession(session: TransportSession, message: DIDCommMessage) {
    this.logger.debug(`Existing ${session.type} transport session has been found.`, {
      keys: session.keys,
    })
    if (!session.keys) {
      throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
    }
    const encryptedMessage = await this.envelopeService.packMessageEncrypted(message, session.keys)
    await session.send(encryptedMessage)
  }

  public async sendDIDCommV1Message(outboundMessage: OutboundMessage, options?: SendMessageOptions) {
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

    if (!connection.did) {
      this.logger.error(`Unable to send message using connection '${connection.id}' that doesn't have a did`)
      throw new AriesFrameworkError(
        `Unable to send message using connection '${connection.id}' that doesn't have a did`
      )
    }

    const ourDidDocument = await this.didResolverService.resolveDidDocument(connection.did)
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
        await this.packAndSendMessage({
          message: payload,
          service,
          senderKey: firstOurAuthenticationKey.publicKeyBase58,
          returnRoute: shouldAddReturnRoute,
          connection,
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
        recipientKeys: queueService.recipientKeys.map((key) => key.publicKeyBase58),
        routingKeys: queueService.routingKeys.map((key) => key.publicKeyBase58),
        senderKey: firstOurAuthenticationKey.publicKeyBase58,
      }

      const encryptedMessage = await this.envelopeService.packMessageEncrypted(payload, keys)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

  public async sendDIDCommV2Message(
    message: DIDCommV2Message,
    sendingMessageType: SendingMessageType = SendingMessageType.Encrypted,
    transports?: Transports[],
    mayProxyVia?: string
  ) {
    this.logger.debug(`Prepare to send DIDCommV2 message ${message.id}`, {
      context: LogContexts.messageSender.context,
      logId: LogContexts.messageSender.prepareToSend,
      message,
      sendingMessageType,
      mayProxyVia,
    })
    // recipient is not specified -> send to defaultTransport
    if (!message.to?.length && transports?.length) {
      const service = new DidCommV2Service({
        id: transports[0],
        serviceEndpoint: transports[0],
      })

      if (sendingMessageType === SendingMessageType.Plain) {
        // send message plaintext
        return await this.sendPlaintextMessage(message, service)
      }

      if (sendingMessageType === SendingMessageType.Signed) {
        return await this.sendSignedMessage(message, service)
      }

      if (sendingMessageType === SendingMessageType.Encrypted) {
        throw new AriesFrameworkError(`Unable to send message encrypted. Message doesn't contain recipient DID.`)
      }
      return
    }

    // recipient is not specified and transport is not passed explicitly
    if (!message.to?.length && !transports?.length) return

    // find service transport supported for both sender and receiver
    const recipient = message.recipient()
    const senderToRecipientService = await this.findCommonSupportedService(message.sender, recipient, transports)

    if (senderToRecipientService) {
      if (sendingMessageType === SendingMessageType.Plain) {
        // send message plaintext
        return await this.sendPlaintextMessage(message, senderToRecipientService)
      }

      if (sendingMessageType === SendingMessageType.Signed) {
        // send message signed
        return await this.sendSignedMessage(message, senderToRecipientService)
      }

      if (sendingMessageType === SendingMessageType.Encrypted) {
        // send message encrypted
        return await this.sendEncryptedMessage(message, senderToRecipientService)
      }
    }

    // send message via proxy if specified
    if (mayProxyVia) {
      return await this.sendMessageViaProxy(message, mayProxyVia, sendingMessageType, transports)
    }

    this.agentConfig.logger.error(
      `Unable to send message. Unexpected case: sendingMessageType: ${sendingMessageType}, mayProxyVia: ${mayProxyVia}`
    )
  }

  public async findCommonSupportedService(
    sender?: string,
    recipient?: string,
    priorityTransports?: Transports[]
  ): Promise<DidCommV2Service | undefined> {
    if (!recipient) return undefined

    const { didDocument: senderDidDocument } = await this.didResolverService.resolve(sender)

    const { didDocument: recipientDidDocument } = await this.didResolverService.resolve(recipient)
    if (!recipientDidDocument) {
      throw new AriesFrameworkError(`Unable to resolve did document for did '${recipient}'`)
    }

    const senderServices = senderDidDocument?.service || []
    const recipientServices = recipientDidDocument?.service || []

    const senderTransports = senderServices.length
      ? senderServices.map((service) => service.protocolScheme)
      : this.agentConfig.transports // FIXME: use outbound transports

    const supportedTransports = priorityTransports?.length
      ? [...priorityTransports, ...senderTransports]
      : senderTransports

    // Sort services according to supported transports
    const priority = supportedTransports.map((transport) => transport.toString())

    const services = recipientServices.sort(function (a, b) {
      return priority.indexOf(a.protocolScheme) - priority.indexOf(b.protocolScheme)
    })

    const service = services.find((service) => {
      if (priority.includes(service.protocolScheme)) return service
    })

    return service
  }

  private async encryptedMessage(message: DIDCommV2Message, service: DidDocumentService, forward?: boolean) {
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
    return this.envelopeService.packMessageEncrypted(message, params)
  }

  private async sendPlaintextMessage(message: DIDCommV2Message, service: DidDocumentService) {
    this.agentConfig.logger.debug(`Sending plaintext message ${message.id}`)
    const recipientDid = message.recipient()
    const payload = { ...message }
    return this.sendMessage(payload, service, recipientDid)
  }

  private async sendSignedMessage(message: DIDCommV2Message, service: DidDocumentService) {
    if (!message.from) {
      throw new AriesFrameworkError(`Unable to send message signed. Message doesn't contain sender DID.`)
    }

    this.agentConfig.logger.debug(`Sending JWS message ${message.id}`)

    const params = { signByDID: message.from, serviceId: service?.id }
    const recipientDid = message.recipient()

    const payload = await this.envelopeService.packMessageSigned(message, params)

    return this.sendMessage(payload, service, recipientDid)
  }

  private async sendEncryptedMessage(message: DIDCommV2Message, service: DidDocumentService) {
    const recipientDid = message.recipient()
    if (!recipientDid) {
      throw new AriesFrameworkError(`Unable to send message encrypted. Message doesn't contain recipient DID.`)
    }
    this.agentConfig.logger.debug(`Sending JWE message ${message.id}`)
    const encryptedMessage = await this.encryptedMessage(message, service)
    return this.sendMessage(encryptedMessage, service, recipientDid)
  }

  private async sendMessageViaProxy(
    message: DIDCommV2Message,
    proxy: string,
    sendingMessageType: SendingMessageType = SendingMessageType.Encrypted,
    transports?: Transports[]
  ) {
    // only encrypted message can be sent via proxy
    if (sendingMessageType !== SendingMessageType.Encrypted) return

    this.agentConfig.logger.info(`Sending message ${message.id} using proxy: ${proxy}`)

    // Try to use proxy
    // find service transport supported for both proxy and receiver + sender and proxy
    const proxyToRecipientSupportedService = await this.findCommonSupportedService(
      proxy,
      message.recipient(),
      transports
    )
    if (!proxyToRecipientSupportedService) return

    const senderToProxyService = await this.findCommonSupportedService(message.sender, proxy, transports)
    if (!senderToProxyService) return

    const encryptedMessage = await this.prepareMessageForProxy(
      message,
      proxy,
      proxyToRecipientSupportedService,
      senderToProxyService
    )

    return this.sendMessage(encryptedMessage, senderToProxyService, proxy)
  }

  private async prepareMessageForProxy(
    message: DIDCommV2Message,
    proxy: string,
    proxyToRecipientSupportedService: DidCommV2Service,
    senderToProxyService: DidCommV2Service
  ): Promise<EncryptedMessage> {
    this.agentConfig.logger.debug(`Prepare message ${message.id} for proxy: ${proxy}`)
    let encryptedMessage = await this.encryptedMessage(message, proxyToRecipientSupportedService)

    // if proxy uses mediator -> we need to wrap our encrypted message into additional forward
    if (senderToProxyService.routingKeys?.length) {
      const did = DidDocument.extractDidFromKid(senderToProxyService.routingKeys[0])
      const proxyForwardMessage = new ForwardMessageV2({
        from: message.from,
        to: did,
        body: {
          next: proxy,
        },
        attachments: [DIDCommV2Message.createJSONAttachment(uuid(), encryptedMessage)],
      })
      encryptedMessage = await this.encryptedMessage(proxyForwardMessage, senderToProxyService, false)
    }
    this.agentConfig.logger.debug(`Prepare message ${message.id} for proxy: ${proxy} completed!`)
    return encryptedMessage
  }

  public async sendMessage(message: OutboundPackagePayload, service: DidDocumentService, recipient?: string) {
    const outboundPackage = { payload: message, recipientDid: recipient, endpoint: service.serviceEndpoint }
    await this.sendOutboundPackage(outboundPackage, service.protocolScheme)
  }

  public async packAndSendMessage({
    message,
    service,
    senderKey,
    returnRoute,
    connection,
  }: {
    message: DIDCommMessage
    service: ResolvedDidCommService
    senderKey?: string
    returnRoute?: boolean
    connection?: ConnectionRecord
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    this.logger.debug(`Sending outbound message to service:`, {
      messageId: message.id,
      service: { ...service, recipientKeys: 'omitted...', routingKeys: 'omitted...' },
    })

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

    const outboundPackage = await this.packMessage({ connection, message, senderKey, service })
    outboundPackage.endpoint = service.serviceEndpoint
    outboundPackage.connectionId = connection?.id
    for (const transport of this.outboundTransports) {
      const protocolScheme = getProtocolScheme(service.serviceEndpoint)
      if (!protocolScheme) {
        this.logger.warn('Service does not have valid protocolScheme.')
      } else if (transport.supportedSchemes.includes(protocolScheme)) {
        await transport.sendMessage(outboundPackage)
        return
      }
    }
    throw new AriesFrameworkError(`Unable to send message to service: ${service?.serviceEndpoint}`)
  }

  public async sendOutboundPackage(outboundPackage: OutboundPackage, transport?: string) {
    this.logger.debug(`Sending outbound message to transport:`, { transport, outboundPackage })
    if (transport) {
      for (const outboundTransport of this.outboundTransports) {
        if (outboundTransport.supportedSchemes.includes(transport)) {
          await outboundTransport.sendMessage(outboundPackage)
          break
        }
      }
    } else {
      // try to send to the first registered
      await this.outboundTransports[0]?.sendMessage(outboundPackage)
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

    let didCommServices: ResolvedDidCommService[] = []

    if (connection.theirDid) {
      this.logger.debug(`Resolving services for connection theirDid ${connection.theirDid}.`)
      didCommServices = await this.didCommDocumentService.resolveServicesFromDid(connection.theirDid)
    } else if (outOfBand) {
      this.logger.debug(`Resolving services from out-of-band record ${outOfBand.id}.`)
      if (connection.isRequester) {
        for (const service of outOfBand.outOfBandInvitation.getServices()) {
          // Resolve dids to DIDDocs to retrieve services
          if (typeof service === 'string') {
            this.logger.debug(`Resolving services for did ${service}.`)
            didCommServices.push(...(await this.didCommDocumentService.resolveServicesFromDid(service)))
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

  public async sendMessageToService({
    message,
    service,
    senderKey,
    returnRoute,
    connectionId,
  }: {
    message: DIDCommV1Message
    service: ResolvedDidCommService
    senderKey: string
    returnRoute?: boolean
    connectionId?: string
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }

    this.logger.debug(`Sending outbound message to service:`, {
      messageId: message.id,
      service: { ...service, recipientKeys: 'omitted...', routingKeys: 'omitted...' },
    })

    // const keys = {
    //   recipientKeys: service.recipientKeys,
    //   routingKeys: service.routingKeys,
    //   senderKey,
    // }

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

    const outboundPackage = await this.packMessage({ message, senderKey, service })
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
