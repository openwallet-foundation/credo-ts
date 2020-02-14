import { OutboundMessage, OutboundPackage } from '../types';
import { Handler } from '../handlers/Handler';
import { MessageSender } from './MessageSender';

class Dispatcher {
  handlers: { [key: string]: Handler } = {};
  messageSender: MessageSender;

  constructor(handlers: { [key: string]: Handler } = {}, messageSender: MessageSender) {
    this.handlers = handlers;
    this.messageSender = messageSender;
  }

  async dispatch(inboundMessage: any): Promise<OutboundMessage | OutboundPackage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.handlers[messageType];

    if (!handler) {
      throw new Error(`No handler for message type "${messageType}" found`);
    }

    const outboundMessage = await handler.handle(inboundMessage);
    if (outboundMessage) {
      if (inboundMessage.message['~transport']) {
        return await this.messageSender.packMessage(outboundMessage);
      }
      await this.messageSender.sendMessage(outboundMessage);
    }
    return outboundMessage;
  }
}

export { Dispatcher };
