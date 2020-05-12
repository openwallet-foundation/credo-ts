import { OutboundMessage } from '../types';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { transport } from '../decorators';
import { EnvelopeService } from './EnvelopeService';

class MessageSender {
  envelopeService: EnvelopeService;
  outboundTransporter: OutboundTransporter;

  constructor(envelopeService: EnvelopeService, outboundTransporter: OutboundTransporter) {
    this.envelopeService = envelopeService;
    this.outboundTransporter = outboundTransporter;
  }

  async packMessage(outboundMessage: OutboundMessage) {
    return this.envelopeService.packMessage(outboundMessage);
  }

  async sendMessage(outboundMessage: OutboundMessage) {
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage);
    await this.outboundTransporter.sendMessage(outboundPackage, false);
  }

  async sendAndReceiveMessage(outboundMessage: OutboundMessage) {
    transport(outboundMessage.payload);
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage);
    const packedMessage = await this.outboundTransporter.sendMessage(outboundPackage, true);
    const message = await this.envelopeService.unpackMessage(packedMessage);
    return message;
  }
}

export { MessageSender };
