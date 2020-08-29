import { OutboundMessage, OutboundPackage } from '../types';
import { Handler } from '../handlers/Handler';
import { MessageSender } from './MessageSender';
import { AgentMessage } from './AgentMessage';
import { InboundMessageContext } from './models/InboundMessageContext';

class Dispatcher {
  private handlers: Handler[] = [];
  private messageSender: MessageSender;

  public constructor(messageSender: MessageSender) {
    this.messageSender = messageSender;
  }

  public registerHandler(handler: Handler) {
    this.handlers.push(handler);
  }

  public async dispatch(messageContext: InboundMessageContext): Promise<OutboundMessage | OutboundPackage | undefined> {
    const message = messageContext.message;
    const handler = this.getHandlerForType(message.type);

    if (!handler) {
      throw new Error(`No handler for message type "${message.type}" found`);
    }

    const outboundMessage = await handler.handle(messageContext);

    if (outboundMessage) {
      const threadId = outboundMessage.payload.getThreadId();

      // check for return routing, with thread id
      if (message.hasReturnRouting(threadId)) {
        return await this.messageSender.packMessage(outboundMessage);
      }

      await this.messageSender.sendMessage(outboundMessage);
    }

    return outboundMessage || undefined;
  }

  private getHandlerForType(messageType: string): Handler | undefined {
    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (MessageClass.type === messageType) return handler;
      }
    }
  }

  public getMessageClassForType(messageType: string): typeof AgentMessage | undefined {
    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (MessageClass.type === messageType) return MessageClass;
      }
    }
  }
}

export { Dispatcher };
