import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { ConstructableAgentMessage } from './AgentMessage'
import type { InboundMessageContext } from './models/InboundMessageContext'

export interface Handler {
  readonly supportedMessages: readonly ConstructableAgentMessage[]

  handle(messageContext: InboundMessageContext): Promise<OutboundMessage | OutboundServiceMessage | void>
}

/**
 * Provides exact typing for the AgentMessage in the message context in the `handle` function
 * of a handler. It takes all possible types from `supportedMessageTypes`
 *
 * @example
 * async handle(messageContext: HandlerInboundMessage<BasicMessageHandler>) {}
 */
export type HandlerInboundMessage<H extends Handler> = InboundMessageContext<
  InstanceType<H['supportedMessages'][number]>
>
