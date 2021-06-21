import type { DidCommService } from '../modules/connections'
import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage } from '../types'

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

  public async packMessage(outboundMessage: OutboundMessage, service: DidCommService): Promise<OutboundPackage> {
    const { connection, payload } = outboundMessage
    const { verkey, theirKey } = connection
    const endpoint = service.serviceEndpoint
    const message = payload.toJSON()
    this.logger.debug('outboundMessage', { verkey, theirKey, message })
    const keys = {
      recipientKeys: service.recipientKeys,
      routingKeys: service.routingKeys || [],
      senderKey: connection.verkey,
    }
    const wireMessage = await this.envelopeService.packMessage(keys, outboundMessage.payload)
    const responseRequested = outboundMessage.payload.hasReturnRouting()
    return { connection, payload: wireMessage, endpoint, responseRequested }
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    if (!this.outboundTransporter) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    const services = this.transportService.findDidCommServices(outboundMessage.connection)
    if (services.length === 0) {
      throw new AriesFrameworkError(`Connection with id ${outboundMessage.connection.id} has no service!`)
    }

    for await (const service of services) {
      this.logger.debug(`Sending outbound message to service:`, { service })
      try {
        const outboundPackage = await this.packMessage(outboundMessage, service)
        outboundPackage.session = this.transportService.findSession(outboundMessage.connection.id)
        await this.outboundTransporter.sendMessage(outboundPackage)
        break
      } catch (error) {
        this.logger.debug(
          `Sending outbound message to service with id ${service.id} failed with the following error:`,
          {
            error,
          }
        )
      }
    }
  }
}
