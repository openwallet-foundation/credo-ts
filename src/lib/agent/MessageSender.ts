import logger from '../logger';
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

  async sendMessage(outboundMessage: OutboundMessage, receive_reply: boolean = false) {
    if (receive_reply) {
      transport(outboundMessage.payload);
    }
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage);
    const reply = await this.outboundTransporter.sendMessage(outboundPackage, receive_reply);
    if (receive_reply) {
      return reply;
    }
  }

  async sendMessageAndGetReply(outboundMessage: OutboundMessage) {
    return await this.sendMessage(outboundMessage, true);
  }

  async sendAndReceive(outboundMessage: OutboundMessage) {
    transport(outboundMessage.payload);
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage);
    const packedMessage = await this.outboundTransporter.sendMessage(outboundPackage, true);
    const message = await this.envelopeService.unpackMessage(packedMessage);
    return message;
  }
}

export { MessageSender };
