import { OutboundMessage } from '../types';
import { AgentMessage } from '../agent/AgentMessage';
import { MessageContext } from '../agent/models/MessageContext';

export interface Handler<T extends typeof AgentMessage = typeof AgentMessage> {
  readonly supportedMessages: readonly T[];

  handle(messageContext: MessageContext): Promise<OutboundMessage | void>;
}

/**
 * Provides exact typing for the AgentMessage in the message context in the `handle` function
 * of a handler. It takes all possible types from `supportedMessageTypes`
 *
 * @example
 * async handle(messageContext: HandlerInboundMessage<BasicMessageHandler>) {}
 */
export type HandlerInboundMessage<H extends Handler> = MessageContext<InstanceType<H['supportedMessages'][number]>>;
