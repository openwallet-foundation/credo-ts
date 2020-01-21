import { OutboundMessage, TYPES } from '../types';
import { Handler } from '../handlers/Handler';
import { MessageSender } from './MessageSender';
import { injectable, inject, optional } from 'inversify';

@injectable()
class Dispatcher {
  handlers: { [key: string]: Handler } = {};
  messageSender: MessageSender;

  constructor(
    @inject(TYPES.Handlers) @optional() handlers: { [key: string]: Handler } = {},
    @inject(TYPES.MessageSender) messageSender: MessageSender
  ) {
    this.handlers = handlers;
    this.messageSender = messageSender;
  }

  async dispatch(inboundMessage: any): Promise<OutboundMessage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.handlers[messageType];

    if (!handler) {
      throw new Error(`No handler for message type "${messageType}" found`);
    }

    const outboundMessage = await handler.handle(inboundMessage);
    if (outboundMessage) {
      this.messageSender.sendMessage(outboundMessage);
    }
    return outboundMessage;
  }
}

export { Dispatcher };
