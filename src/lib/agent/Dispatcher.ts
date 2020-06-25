import { OutboundMessage, OutboundPackage } from '../types';
import { Handler } from '../handlers/Handler';
import { MessageSender } from './MessageSender';

class Dispatcher {
  handlers: Handler[] = [];
  messageSender: MessageSender;

  constructor(messageSender: MessageSender) {
    this.messageSender = messageSender;
  }

  registerHandler(handler: Handler) {
    this.handlers.push(handler);
  }

  async dispatch(inboundMessage: any): Promise<OutboundMessage | OutboundPackage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.getHandlerForType(messageType);

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

  private getHandlerForType(messageType: string): Handler | undefined {
    return this.handlers.find(handler => handler.supportedMessageTypes.includes(messageType));
  }
}

export { Dispatcher };
