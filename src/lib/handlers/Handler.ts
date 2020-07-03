import { InboundMessage, OutboundMessage } from '../types';
import { AgentMessage } from '../agent/AgentMessage';

export interface Handler<T extends typeof AgentMessage = typeof AgentMessage> {
  readonly supportedMessages: readonly T[];

  handle(inboundMessage: InboundMessage): Promise<OutboundMessage | void>;
}

/**
 * Provides exact typing for the AgentMessage in the inbound message in the `handle` function
 * of a handler. It takes all possible types from `supportedMessageTypes`
 *
 * @example
 * async handle(inboundMessage: HandlerInboundMessage<BasicMessageHandler>) {}
 */
export type HandlerInboundMessage<H extends Handler> = InboundMessage<InstanceType<H['supportedMessages'][number]>>;
