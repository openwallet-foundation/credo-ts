import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage } from '../types'
import type { EnvelopeKeys } from './EnvelopeService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private logger: Logger
  private _outboundTransporter?: OutboundTransporter

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.logger = logger
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this._outboundTransporter = outboundTransporter
  }

  public get outboundTransporter() {
    return this._outboundTransporter
  }

  public async packMessage(outboundMessage: OutboundMessage, keys: EnvelopeKeys): Promise<OutboundPackage> {
    const { connection, payload } = outboundMessage
    const wireMessage = await this.envelopeService.packMessage(payload, keys)
    return { connection, payload: wireMessage }
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    if (!this.outboundTransporter) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    const { connection, payload } = outboundMessage
    const { id, verkey, theirKey } = connection
    const message = payload.toJSON()
    this.logger.debug('Send outbound message', {
      messageId: message.id,
      connection: { id, verkey, theirKey },
    })

    const session = this.transportService.findSession(connection.id)
    if (
      session?.inboundMessage?.hasReturnRouting() ||
      session?.inboundMessage?.hasReturnRouting(outboundMessage.payload.threadId)
    ) {
      this.logger.debug(`Existing ${session.type} transport session has been found.`)
      if (!session.keys) {
        throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
      }
      const outboundPackage = await this.packMessage(outboundMessage, session.keys)
      try {
        await session.send(outboundPackage)
        return
      } catch (error) {
        this.logger.info('The transport session has been closed or failed to send the outbound message.', error)
      }
    }

    const services = this.transportService.findDidCommServices(connection)
    if (services.length === 0) {
      throw new AriesFrameworkError(`Connection with id ${connection.id} has no service!`)
    }

    for await (const service of services) {
      this.logger.debug(`Sending outbound message to service:`, { messageId: message.id, service })
      try {
        const keys = {
          recipientKeys: service.recipientKeys,
          routingKeys: service.routingKeys || [],
          senderKey: connection.verkey,
        }
        const outboundPackage = await this.packMessage(outboundMessage, keys)
        outboundPackage.endpoint = service.serviceEndpoint
        outboundPackage.responseRequested = outboundMessage.payload.hasReturnRouting()

        await this.outboundTransporter.sendMessage(outboundPackage)
        break
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
  }
}
