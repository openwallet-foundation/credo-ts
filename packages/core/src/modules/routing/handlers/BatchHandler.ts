import type { EventEmitter } from '../../../agent/EventEmitter'
import type { AgentMessageReceivedEvent } from '../../../agent/Events'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'

import { AgentEventTypes } from '../../../agent/Events'
import { BatchMessageV2 } from '../messages'

export class BatchHandler implements Handler<typeof DIDCommV2Message> {
  private eventEmitter: EventEmitter
  public supportedMessages = [BatchMessageV2]

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public async handle(messageContext: HandlerInboundMessage<BatchHandler>) {
    const { message } = messageContext
    const forwardedMessages = message.body.messages
    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: message.message,
        },
      })
    })
  }
}
