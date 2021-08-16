import type { DidCommService, ConnectionRecord } from '../modules/connections'
import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage, WireMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'
import type { TransportSession } from './TransportService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { MessageRepository } from '../storage/MessageRepository'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private outboundTransports: OutboundTransporter[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
    this.outboundTransports = []
  }

  public registerOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this.outboundTransports.push(outboundTransporter)
  }

  public get supportedTransportSchemes() {
    // map all supported schema into a new list
    // reduce the list of listed schemas into a single list
    // remove duplicates by creating a new set and spreading it into a list
	const schemeTuples = outboundTransporters.map(transport => transport.supportedSchemes)
    
    const allSchemes = new Array<string>().concat(...schemeTuples)
	const uniqueSchemes = [...new Set(allSchemes)]
		
	return uniqueSchemes
  }

  public get outboundTransporters() {
    return this.outboundTransports
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
    const wireMessage = await this.envelopeService.packMessage(message, keys)

    return {
      payload: wireMessage,
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
    const wireMessage = await this.envelopeService.packMessage(message, session.keys)

    await session.send(wireMessage)
  }

  public async sendPackage({
    connection,
    packedMessage,
    options,
  }: {
    connection: ConnectionRecord
    packedMessage: WireMessage
    options?: { preferredTransport: string }
  }) {
    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting()) {
      try {
        await session.send(packedMessage)
        return
      } catch (error) {
        this.logger.info(`Sending packed message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const allServices = this.transportService.findDidCommServices(connection)
    let reachableServices = allServices.filter((s) => !isDidCommTransportQueue(s.serviceEndpoint))
    if (options && options.preferredTransport) {
      reachableServices = [
        ...new Set(
          reachableServices
            .filter((s) => s.serviceEndpoint.split(':')[0] === options.preferredTransport)
            .concat(reachableServices)
        ),
      ]
    }
    const queueService = allServices.find((s) => isDidCommTransportQueue(s.serviceEndpoint))

    this.logger.debug(
      `Found ${allServices.length} services for message to connection '${connection.id}' (${connection.theirLabel})`
    )

    if (this.outboundTransporters.length === 0 && !queueService) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    // Loop trough all available services and try to send the message
    for await (const service of reachableServices) {
      this.logger.debug(`Sending outbound message to service:`, { service })
      try {
        const protocol = service.serviceEndpoint.split(':')[0]
        for (const transport of this.outboundTransporters) {
          if (transport.supportedSchemes.includes(protocol)) {
            await transport.sendMessage({
              payload: packedMessage,
              endpoint: service.serviceEndpoint,
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
      this.messageRepository.add(connection.id, packedMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: packedMessage,
      connection,
    })
    throw new AriesFrameworkError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  public async sendMessage(outboundMessage: OutboundMessage, options?: { preferredTransport: string }) {
    const { connection, payload } = outboundMessage

    this.logger.debug('Send outbound message', {
      message: payload,
      connectionId: connection.id,
    })

    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting(payload.threadId)) {
      try {
        await this.sendMessageToSession(session, payload)
        return
      } catch (error) {
        this.logger.info(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const allServices = this.transportService.findDidCommServices(connection)
    const reachableServices = allServices.filter((s) => !isDidCommTransportQueue(s.serviceEndpoint))
    if (options?.preferredTransport) {
      reachableServices.sort((f, s) => {
        return f.serviceEndpoint.split(':')[0] === options.preferredTransport ? 1 : 0
      })
    }
    const queueService = allServices.find((s) => isDidCommTransportQueue(s.serviceEndpoint))

    this.logger.debug(
      `Found ${allServices.length} services for message to connection '${connection.id}' (${connection.theirLabel})`
    )

    // Loop trough all available services and try to send the message
    for await (const service of reachableServices) {
      try {
        // Enable return routing if the
        const shouldUseReturnRoute = !this.transportService.hasInboundEndpoint(connection.didDoc)

        await this.sendMessageToService({
          message: payload,
          service,
          senderKey: connection.verkey,
          returnRoute: shouldUseReturnRoute,
        })
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
      this.logger.debug(`Queue message for connection ${connection.id} (${connection.theirLabel})`)

      const keys = {
        recipientKeys: queueService.recipientKeys,
        routingKeys: queueService.routingKeys || [],
        senderKey: connection.verkey,
      }

      const wireMessage = await this.envelopeService.packMessage(payload, keys)
      this.messageRepository.add(connection.id, wireMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: payload,
      connection,
    })
    throw new AriesFrameworkError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  public async sendMessageToService({
    message,
    service,
    senderKey,
    returnRoute,
  }: {
    message: AgentMessage
    service: DidCommService
    senderKey: string
    returnRoute?: boolean
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    this.logger.debug(`Sending outbound message to service:`, { messageId: message.id, service })

    const keys = {
      recipientKeys: service.recipientKeys,
      routingKeys: service.routingKeys || [],
      senderKey,
    }

    // Set return routing for message if requested
    if (returnRoute) {
      message.setReturnRouting(ReturnRouteTypes.all)
    }

    const outboundPackage = await this.packMessage({ message, keys, endpoint: service.serviceEndpoint })
    outboundPackage.endpoint = service.serviceEndpoint
    const protocol = outboundPackage.endpoint.split(':')[0]
    for (const transport of this.outboundTransporters) {
      if (transport.supportedSchemes.includes(protocol)) {
        await transport.sendMessage(outboundPackage)
        break
      }
    }
  }
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}
