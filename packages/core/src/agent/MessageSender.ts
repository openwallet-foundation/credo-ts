import type { ConnectionRecord } from '../modules/connections'
import type { DidCommService, DidDocumentService, IndyAgentService } from '../modules/dids/domain/service'
import type { AcceptProtocol, Transports } from '../modules/routing/types'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type { OutboundMessage, OutboundPackage, OutboundPackagePayload, SendMessageOptions } from '../types'
import type { TransportSession } from './TransportService'
import type { DIDCommMessage, EncryptedMessage } from './didcomm'
import type { PackMessageParams } from './didcomm/EnvelopeService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { DidDocument } from '../modules/dids/domain/DidDocument'
import { DidCommV2Service } from '../modules/dids/domain/service'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { ForwardMessageV2 } from '../modules/routing/messages'
import { MessageRepository } from '../storage/MessageRepository'
import { MessageValidator } from '../utils/MessageValidator'
import { uuid } from '../utils/uuid'

import { AgentConfig } from './AgentConfig'
import { TransportService } from './TransportService'
import { DIDCommV2Message } from './didcomm'
import { DIDCommVersion } from './didcomm/DIDCommMessage'
import { EnvelopeService } from './didcomm/EnvelopeService'
import { SendingMessageType } from './didcomm/types'

export interface TransportPriorityOptions {
  schemes: string[]
  restrictive?: boolean
}

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private agentConfig: AgentConfig
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private didResolverService: DidResolverService
  public readonly outboundTransports: OutboundTransport[] = []

  public constructor(
    agentConfig: AgentConfig,
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger,
    didResolverService: DidResolverService
  ) {
    this.agentConfig = agentConfig
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
    connection,
    senderKey,
    service,
    message,
  }: {
    connection?: ConnectionRecord
    senderKey?: string
    accept?: AcceptProtocol[]
    service?: DidCommService | IndyAgentService
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
        recipientKeys: service.recipientKeys,
        routingKeys: service.routingKeys || [],
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
    const { connection, payload } = outboundMessage
    const errors: Error[] = []

    this.logger.debug('Send outbound message', {
      message: payload,
      connectionId: connection.id,
    })

    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
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
    const { services, queueService } = await this.retrieveServicesByConnection(connection, options?.transportPriority)

    // Loop through all available services and try to send the message
    for await (const service of services) {
      try {
        // Enable return routing if the
        const shouldUseReturnRoute = !this.transportService.hasInboundEndpoint(connection.didDoc)

        await this.packAndSendMessage({
          message: payload,
          service,
          senderKey: connection.verkey,
          returnRoute: shouldUseReturnRoute,
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
        recipientKeys: queueService.recipientKeys,
        routingKeys: queueService.routingKeys || [],
        senderKey: connection.verkey,
      }

      const encryptedMessage = await this.envelopeService.packMessageEncrypted(payload, keys)
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
    proxy?: string
  ) {
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
    if (proxy) {
      return await this.sendMessageViaProxy(message, proxy, sendingMessageType, transports)
    }

    this.agentConfig.logger.error(
      `Unable to send message. Unexpected case: sendingMessageType: ${sendingMessageType}, proxy: ${proxy}`
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
    const recipientDid = message.recipient()
    const payload = { ...message }
    return this.sendMessage(payload, service, recipientDid)
  }

  private async sendSignedMessage(message: DIDCommV2Message, service: DidDocumentService) {
    if (!message.from) {
      throw new AriesFrameworkError(`Unable to send message signed. Message doesn't contain sender DID.`)
    }

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
    let encryptedMessage = await this.encryptedMessage(message, proxyToRecipientSupportedService)

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
    service?: DidCommService
    senderKey?: string
    returnRoute?: boolean
    connection?: ConnectionRecord
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transport!')
    }
    if (!service && !connection) {
      throw new AriesFrameworkError('Either Connection or Service must be passed!')
    }
    const transport = service?.protocolScheme
    if (!transport) {
      throw new AriesFrameworkError('Either Connection or Service must define transport!')
    }

    const endpoint = service?.serviceEndpoint

    // Set return routing for message if requested
    if (returnRoute) {
      message.setReturnRouting(ReturnRouteTypes.all)
    }

    try {
      await MessageValidator.validate(message)
    } catch (error) {
      this.logger.error(`Aborting sending outbound message ${message.type} to ${endpoint}. Message validation failed`, {
        errors: error,
        message: message.toJSON(),
      })

      throw error
    }

    const outboundPackage = await this.packMessage({
      connection,
      service,
      senderKey,
      message,
    })

    outboundPackage.endpoint = endpoint
    outboundPackage.connectionId = connection?.id
    await this.sendOutboundPackage(outboundPackage, transport)
  }

  public async sendOutboundPackage(outboundPackage: OutboundPackage, transport?: string) {
    this.logger.debug(`Sending outbound message to transport:`, { transport })
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
    transportPriority?: TransportPriorityOptions
  ) {
    this.logger.debug(`Retrieving services for connection '${connection.id}' (${connection.theirLabel})`, {
      transportPriority,
    })

    let didCommServices: Array<IndyAgentService | DidCommService> = []

    // If theirDid starts with a did: prefix it means we're using the new did syntax
    // and we should use the did resolver
    if (connection.theirDid?.startsWith('did:')) {
      const {
        didDocument,
        didResolutionMetadata: { error, message },
      } = await this.didResolverService.resolve(connection.theirDid)

      if (!didDocument) {
        throw new AriesFrameworkError(
          `Unable to resolve did document for did '${connection.theirDid}': ${error} ${message}`
        )
      }

      didCommServices = didDocument.didCommServices
    }

    // Old school method, did document is stored inside the connection record
    if (!didCommServices.length) {
      // Retrieve DIDComm services
      didCommServices = this.transportService.findDidCommServices(connection)
    }

    const { services, queueService } = await this.retrieveServicesFromDidCommServices(
      didCommServices,
      transportPriority
    )

    this.logger.debug(
      `Retrieved ${services.length} services for message to connection '${connection.id}'(${connection.theirLabel})'`
    )

    return { services, queueService }
  }

  private async retrieveServicesFromDidCommServices(
    didCommServices: Array<IndyAgentService | DidCommService>,
    transportPriority?: TransportPriorityOptions
  ) {
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

    return { services, queueService }
  }
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}
