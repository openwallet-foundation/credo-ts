import type { ConstructableAgentMessage } from '../DidCommMessage'
import type { InboundDidCommMessageContext, OutboundDidCommMessageContext } from '../models'

export interface DidCommMessageHandler {
  readonly supportedMessages: readonly ConstructableAgentMessage[]

  handle(messageContext: InboundDidCommMessageContext): Promise<OutboundDidCommMessageContext | undefined>
}

/**
 * Provides exact typing for the DidCommMessage in the message context in the `handle` function
 * of a handler. It takes all possible types from `supportedMessageTypes`
 *
 * @example
 * async handle(messageContext: DidCommMessageHandlerInboundMessage<BasicMessageHandler>) {}
 */
export type DidCommMessageHandlerInboundMessage<H extends DidCommMessageHandler> = InboundDidCommMessageContext<
  InstanceType<H['supportedMessages'][number]>
>
