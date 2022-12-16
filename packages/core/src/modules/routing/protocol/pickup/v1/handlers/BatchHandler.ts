import type { EventEmitter } from '../../../../../../agent/EventEmitter'
import type { AgentMessageReceivedEvent } from '../../../../../../agent/Events'
import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'

import { AgentEventTypes } from '../../../../../../agent/Events'
import { BatchMessage } from '../messages'

export class BatchHandler implements MessageHandler {
  private eventEmitter: EventEmitter
  public supportedMessages = [BatchMessage]

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public async handle(messageContext: MessageHandlerInboundMessage<BatchHandler>) {
    const { message } = messageContext

    messageContext.assertReadyConnection()

    const forwardedMessages = message.messages
    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit<AgentMessageReceivedEvent>(messageContext.agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: message.message,
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
        },
      })
    })
  }
}
