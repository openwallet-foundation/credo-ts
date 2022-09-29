import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { DIDCommMessageClass } from './didcomm'
import type { InboundMessageContext } from './models/InboundMessageContext'

export interface Handler<T extends DIDCommMessageClass> {
  readonly supportedMessages: readonly T[]

  handle(messageContext: InboundMessageContext): Promise<OutboundMessage | OutboundServiceMessage | void>
}
/**
 * Provides exact typing for the AgentMessage in the message context in the `handle` function
 * of a handler. It takes all possible types from `supportedMessageTypes`
 *
 * @example
 * async handle(messageContext: HandlerInboundMessage<BasicMessageHandler>) {}
 */
export type HandlerInboundMessage<H extends Handler<DIDCommMessageClass>> = InboundMessageContext<
  InstanceType<H['supportedMessages'][number]>
>
