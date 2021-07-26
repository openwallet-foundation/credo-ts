import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage } from '../types'
import type { EnvelopeKeys } from './EnvelopeService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { MessageRepository } from '../storage/MessageRepository'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'
import { isUnpackedPackedMessage } from './helpers'

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

  public registerOutboundTransporter(outboundTransporter: OutboundTransporter, priority?: number) {
    if (priority && priority >= 0) {
      this.outboundTransporters.splice(priority, 0, outboundTransporter)
    } else {
      this.outboundTransports.push(outboundTransporter)
    }
  }

  public get supportedTransports() {
    // map all supported schema into a new list
    // reduce the list of listed schemas into a single list
    // remove duplicates by creating a new set and spreading it into a list
    return [
      ...new Set(
        (this.outboundTransporters || [])
          .map((transportTuple) => transportTuple.supportedSchemes)
          .reduce((prev, cur) => {
            return prev.concat(cur)
          })
      ),
    ]
  }

  public get outboundTransporters() {
    return this.outboundTransports
  }

  public async packMessage(outboundMessage: OutboundMessage, keys: EnvelopeKeys): Promise<OutboundPackage> {
    const { connection, payload } = outboundMessage
    const wireMessage = await this.envelopeService.packMessage(payload, keys)
    return { connection, payload: wireMessage }
  }

  public async sendMessage(outboundMessage: OutboundMessage | OutboundPackage) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    const { connection } = outboundMessage
    const { id, verkey, theirKey } = connection
    this.logger.debug('Send outbound message', {
      connection: { id, verkey, theirKey },
      isUnpackedMessage: isUnpackedPackedMessage(outboundMessage),
      message: outboundMessage.payload,
      messageType: isUnpackedPackedMessage(outboundMessage) ? outboundMessage.payload.type : 'unknown',
    })

    const threadId = isUnpackedPackedMessage(outboundMessage) ? outboundMessage.payload.threadId : undefined

    // Try sending over already open connection
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting(threadId)) {
      this.logger.debug(`Existing ${session.type} transport session has been found.`)
      try {
        let outboundPackage: OutboundPackage

        // If outboundPackage is instance of AgentMessage we still need to pack
        if (isUnpackedPackedMessage(outboundMessage)) {
          if (!session.keys) {
            throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
          }
          outboundPackage = await this.packMessage(outboundMessage, session.keys)
        }
        // Otherwise we use the message that is already packed. This is often not the case
        // but happens with forwarding packed message
        else {
          outboundPackage = outboundMessage
        }

        await session.send(outboundPackage)
        return
      } catch (error) {
        this.logger.info(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }
    const supportedProtocols = this.supportedTransports
    const services = this.transportService.findDidCommServices(connection, supportedProtocols)
    if (services.length === 0) {
      throw new AriesFrameworkError(`Connection with id ${connection.id} has no service!`)
    }

    this.logger.debug(
      `Found ${services.length} services for message to connection '${connection.id}' (${connection.theirLabel})`
    )

    for await (const service of services) {
      // We can't send message to didcomm:transport/queue
      if (service.serviceEndpoint === DID_COMM_TRANSPORT_QUEUE) {
        this.logger.debug(`Skipping transport queue service for connection '${connection.id}'`, {
          service,
        })
        continue
      }

      this.logger.debug(`Sending outbound message to service:`, { connectionId: connection.id, service })
      try {
        let outboundPackage: OutboundPackage

        // If outboundPackage is instance of AgentMessage we still need to pack
        if (isUnpackedPackedMessage(outboundMessage)) {
          const keys = {
            recipientKeys: service.recipientKeys,
            routingKeys: service.routingKeys || [],
            senderKey: connection.verkey,
          }

          // Set return routing for message if we don't have an inbound endpoint for this connection
          if (!this.transportService.hasInboundEndpoint(outboundMessage.connection.didDoc)) {
            outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
          }

          outboundPackage = await this.packMessage(outboundMessage, keys)
          outboundPackage.responseRequested = outboundMessage.payload.hasReturnRouting()
        } else {
          outboundPackage = outboundMessage
        }

        outboundPackage.endpoint = service.serviceEndpoint
        const protocol = outboundPackage.endpoint.split(':')[0]
        for (const transport of this.outboundTransporters) {
          if (transport.supportedSchemes.includes(protocol)) {
            await transport.sendMessage(outboundPackage)
            break
          }
        }

        return
      } catch (error) {
        this.logger.debug(
          `Preparing outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }

    // We didn't succeed to send the message over open session, or directly to serviceEndpoint
    // If the other party shared a queue service endpoint in their did doc we queue the message
    const queueService = services.find((s) => s.serviceEndpoint === DID_COMM_TRANSPORT_QUEUE)
    if (
      queueService &&
      // FIXME: we can't currently add unpacked message to the queue. This is good for now
      // as forward messages are always packed. Allowing unpacked messages means
      // we can queue undeliverable messages
      !isUnpackedPackedMessage(outboundMessage)
    ) {
      this.logger.debug(
        `Queue message for connection ${outboundMessage.connection.id} (${outboundMessage.connection.theirLabel})`
      )
      this.messageRepository.add(outboundMessage.connection.id, outboundMessage.payload)
    }
  }
}
