import type { AgentMessageReceivedEvent } from '../../../../../agent/Events'
import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'

import { EventEmitter } from '../../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../../agent/Events'
import { V1BatchMessage } from '../messages'

export class V1BatchHandler implements MessageHandler {
  public supportedMessages = [V1BatchMessage]

  public async handle(messageContext: MessageHandlerInboundMessage<V1BatchHandler>) {
    const { message } = messageContext
    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    messageContext.assertReadyConnection()

    const forwardedMessages = message.messages
    forwardedMessages.forEach((message) => {
      eventEmitter.emit<AgentMessageReceivedEvent>(messageContext.agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: message.message,
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
        },
      })
    })
  }
}
