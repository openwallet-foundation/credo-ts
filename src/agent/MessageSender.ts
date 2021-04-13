import { OutboundMessage, OutboundPackage } from '../types'
import { OutboundTransporter } from '../transport/OutboundTransporter'
import { EnvelopeService } from './EnvelopeService'

class MessageSender {
  private envelopeService: EnvelopeService
  private outboundTransporter?: OutboundTransporter

  public constructor(envelopeService: EnvelopeService) {
    this.envelopeService = envelopeService
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
    const returnRoute = outboundMessage.payload.hasReturnRouting()
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage)
    await this.outboundTransporter.sendMessage(outboundPackage, returnRoute)
  }
}

export { MessageSender }
