import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { DIDCommV1Message, DIDCommV2Message } from './didcomm'
import type { InboundMessageContext } from './models/InboundMessageContext'

// FIXME: Combine Handler's into single
export interface Handler<T extends typeof DIDCommV1Message = typeof DIDCommV1Message> {
  readonly supportedMessages: readonly T[]

  handle(messageContext: InboundMessageContext): Promise<OutboundMessage | OutboundServiceMessage | void>
}

export interface HandlerV2<T extends typeof DIDCommV2Message = typeof DIDCommV2Message> {
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
export type HandlerInboundMessage<H extends Handler> = InboundMessageContext<
  InstanceType<H['supportedMessages'][number]>
>

export type HandlerV2InboundMessage<H extends HandlerV2> = InboundMessageContext<
  InstanceType<H['supportedMessages'][number]>
>
