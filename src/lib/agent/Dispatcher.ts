import { OutboundMessage, OutboundPackage, UnpackedMessage } from '../types';
import { Handler } from '../handlers/Handler';
import { MessageSender } from './MessageSender';
import { AgentMessage } from './AgentMessage';
import { MessageTransformer } from './MessageTransformer';

class Dispatcher {
  handlers: Handler[] = [];
  messageSender: MessageSender;

  constructor(messageSender: MessageSender) {
    this.messageSender = messageSender;
  }

  registerHandler(handler: Handler) {
    this.handlers.push(handler);
  }

  async dispatch(inboundMessage: UnpackedMessage): Promise<OutboundMessage | OutboundPackage | undefined> {
    const messageType: string = inboundMessage.message['@type'];
    const { handler, MessageClass } = this.getHandlerForType(messageType);

    if (!handler || !MessageClass) {
      throw new Error(`No handler or message class for message type "${messageType}" found`);
    }

    // Cast the plain JSON object to specific instance of Message extended from AgentMessage
    const message = MessageTransformer.toMessageInstance(inboundMessage.message, MessageClass);
    const outboundMessage = await handler.handle({ ...inboundMessage, message });

    if (outboundMessage) {
      const threadId = outboundMessage.payload.getThreadId();

      // check for return routing, with thread id
      if (message.hasReturnRouting(threadId)) {
        return await this.messageSender.packMessage(outboundMessage);
      }

      await this.messageSender.sendMessage(outboundMessage);
    }

    return;
  }

  private getHandlerForType(messageType: string): { handler?: Handler; MessageClass?: typeof AgentMessage } {
    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (MessageClass.type === messageType) return { handler, MessageClass };
      }
    }

    return {};
  }
}

export { Dispatcher };
