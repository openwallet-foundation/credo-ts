import type { EventEmitter } from '../../../agent/EventEmitter'
import type { AgentMessageReceivedEvent } from '../../../agent/Events'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'

import { AgentEventTypes } from '../../../agent/Events'
import { BatchMessage } from '../messages'

export class BatchHandler implements Handler {
  private eventEmitter: EventEmitter
  public supportedMessages = [BatchMessage]

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public async handle(messageContext: HandlerInboundMessage<BatchHandler>) {
    const { message } = messageContext

    messageContext.assertReadyConnection()

    const forwardedMessages = message.messages
    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit<AgentMessageReceivedEvent>(messageContext.agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: message.message,
        },
      })
    })
  }
}
