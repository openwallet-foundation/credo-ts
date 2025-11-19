import type { ConstructableAgentMessage } from '../DidCommMessage'
import type { DidCommInboundMessageContext, DidCommOutboundMessageContext } from '../models'

export interface DidCommMessageHandler {
  readonly supportedMessages: readonly ConstructableAgentMessage[]

  handle(messageContext: DidCommInboundMessageContext): Promise<DidCommOutboundMessageContext | undefined>
}

/**
 * Provides exact typing for the DidCommMessage in the message context in the `handle` function
 * of a handler. It takes all possible types from `supportedMessageTypes`
 *
 * @example
 * async handle(messageContext: DidCommMessageHandlerInboundMessage<BasicMessageHandler>) {}
 */
export type DidCommMessageHandlerInboundMessage<H extends DidCommMessageHandler> = DidCommInboundMessageContext<
  InstanceType<H['supportedMessages'][number]>
>
