import type { EventEmitter } from '../../../../../../agent/EventEmitter'
import type { AgentMessageReceivedEvent } from '../../../../../../agent/Events'
import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { MessagePickupService } from '../MessagePickupService'

import { AgentEventTypes } from '../../../../../../agent/Events'
import { BatchMessageV2 } from '../messages'

export class BatchHandler implements Handler {
  private eventEmitter: EventEmitter
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public supportedMessages = [BatchMessageV2]

  public constructor(
    eventEmitter: EventEmitter,
    messagePickupService: MessagePickupService,
    messageSender: MessageSender
  ) {
    this.eventEmitter = eventEmitter
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<BatchHandler>) {
    const { message } = messageContext
    const forwardedMessages = message.body.messages
    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: BatchMessageV2.unpackAttachmentAsJson(message.message),
        },
      })
    })
    const ackMessage = await this.messagePickupService.generateAckResponse(messageContext)
    if (ackMessage) {
      await this.messageSender.sendDIDCommV2Message(ackMessage)
    }
  }
}
