import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { DIDCommMessageInstance } from './didcomm/types'
import type { InboundMessageContext } from './models/InboundMessageContext'

export interface Handler<T extends DIDCommMessageInstance> {
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
export type HandlerInboundMessage<H extends Handler<DIDCommMessageInstance>> = InboundMessageContext<
  InstanceType<H['supportedMessages'][number]>
>
