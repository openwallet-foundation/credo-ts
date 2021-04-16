import { EventEmitter } from 'events'
import { Handler, HandlerInboundMessage } from '../../../agent/Handler'

import { BatchMessage } from '../messages'

export class BatchHandler implements Handler {
  private eventEmitter: EventEmitter
  public supportedMessages = [BatchMessage]

  public constructor(eventEmmiter: EventEmitter) {
    this.eventEmitter = eventEmmiter
  }

  public async handle(messageContext: HandlerInboundMessage<BatchHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const { message } = messageContext
    const forwardedMessages = message.messages

    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit('agentMessage', message.message)
    })
  }
}
