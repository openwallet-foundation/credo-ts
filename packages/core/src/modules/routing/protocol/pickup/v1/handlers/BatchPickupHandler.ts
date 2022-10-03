import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { MessagePickupService } from '../MessagePickupService'

import { BatchPickupMessageV2 } from '../messages'

export class BatchPickupHandler implements Handler {
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public supportedMessages = [BatchPickupMessageV2]

  public constructor(messagePickupService: MessagePickupService, messageSender: MessageSender) {
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<BatchPickupHandler>) {
    const message = await this.messagePickupService.batch(messageContext)
    if (message) {
      await this.messageSender.sendDIDCommV2Message(message)
    }
  }
}
