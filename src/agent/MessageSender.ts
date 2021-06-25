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

  public async packOutBoundMessage(outboundMessage: OutboundMessage) {
    const { connection, payload } = outboundMessage
    const { id, verkey, theirKey } = connection
    const message = payload.toJSON()
    this.logger.debug('Send outbound message', {
      messageId: message.id,
      connection: { id, verkey, theirKey },
    })

    const services = this.transportService.findDidCommServices(connection)
    if (services.length === 0) {
      throw new AriesFrameworkError(`Connection with id ${connection.id} has no service!`)
    }

    for await (const service of services) {
      this.logger.debug(`Preparing outbound message to service:`, { messageId: message.id, service })
      try {
        const keys = {
          recipientKeys: service.recipientKeys,
          routingKeys: service.routingKeys || [],
          senderKey: connection.verkey,
        }
        const outboundPackage = await this.packMessage(outboundMessage, keys)
        outboundPackage.session = this.transportService.findSession(connection.id)
        outboundPackage.endpoint = service.serviceEndpoint
        outboundPackage.responseRequested = outboundMessage.payload.hasReturnRouting()
        return outboundPackage
      } catch (error) {
        this.logger.debug(
          `Prepareing outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    if (!this.outboundTransporter) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }
    const message = await this.packOutBoundMessage(outboundMessage)
    if (message) {
      await this.outboundTransporter.sendMessage(message)
    }
  }
}
