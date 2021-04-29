import { Lifecycle, scoped } from 'tsyringe'

import { OutboundMessage, OutboundPackage } from '../types'
import { OutboundTransporter } from '../transport/OutboundTransporter'
import { EnvelopeService } from './EnvelopeService'
import { HttpTransport, TransportService, WebSocketTransport } from './TransportService'
import { ConnectionRecord } from '../modules/connections'

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private outboundTransporter?: OutboundTransporter

  public constructor(envelopeService: EnvelopeService, transportService: TransportService) {
    this.envelopeService = envelopeService
    this.transportService = transportService
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this.outboundTransporter = outboundTransporter
  }

  public async packMessage(outboundMessage: OutboundMessage): Promise<OutboundPackage> {
    return this.envelopeService.packMessage(outboundMessage)
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    if (!this.outboundTransporter) {
      throw new Error('Agent has no outbound transporter!')
    }
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage)
    await this.outboundTransporter.sendMessage(outboundPackage)
  }
}
