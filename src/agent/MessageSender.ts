import type { Logger } from '../logger'
import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage } from '../types'
import type { EnvelopeService } from './EnvelopeService'
import type { TransportService } from './TransportService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'

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

  public async packMessage(outboundMessage: OutboundMessage): Promise<OutboundPackage> {
    const { connection, payload } = outboundMessage
    const { verkey, theirKey } = connection
    const endpoint = this.transportService.findEndpoint(connection)
    const message = payload.toJSON()
    this.logger.debug('outboundMessage', { verkey, theirKey, message })
    const responseRequested = outboundMessage.payload.hasReturnRouting()
    const wireMessage = await this.envelopeService.packMessage(outboundMessage)
    return { connection, payload: wireMessage, endpoint, responseRequested }
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    if (!this.outboundTransporter) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }
    const outboundPackage = await this.packMessage(outboundMessage)
    outboundPackage.session = this.transportService.findSession(outboundMessage.connection.id)
    await this.outboundTransporter.sendMessage(outboundPackage)
  }
}
