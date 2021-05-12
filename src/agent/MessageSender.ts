import { Lifecycle, scoped } from 'tsyringe'

import { OutboundMessage, OutboundPackage } from '../types'
import { OutboundTransporter } from '../transport/OutboundTransporter'
import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private _outboundTransporter?: OutboundTransporter

  public constructor(envelopeService: EnvelopeService, transportService: TransportService) {
    this.envelopeService = envelopeService
    this.transportService = transportService
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this._outboundTransporter = outboundTransporter
  }

  public get outboundTransporter() {
    return this._outboundTransporter
  }

  public async packMessage(outboundMessage: OutboundMessage): Promise<OutboundPackage> {
    return this.envelopeService.packMessage(outboundMessage)
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    if (!this.outboundTransporter) {
      throw new Error('Agent has no outbound transporter!')
    }
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage)
    const transport = this.transportService.resolveTransport(outboundMessage.connection)
    outboundPackage.transport = transport
    await this.outboundTransporter.sendMessage(outboundPackage)
  }
}
