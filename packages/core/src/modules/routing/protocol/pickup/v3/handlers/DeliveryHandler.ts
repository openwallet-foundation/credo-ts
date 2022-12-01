import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { MessagePickupService } from '../MessagePickupService'

import { DeliveryMessage } from '../messages'

export class DeliveryHandler implements Handler {
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public supportedMessages = [DeliveryMessage]

  public constructor(messagePickupService: MessagePickupService, messageSender: MessageSender) {
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<DeliveryHandler>) {
    const responseMessage = await this.messagePickupService.handleDelivery(messageContext)
    if (responseMessage) {
      await this.messageSender.sendDIDCommV2Message(responseMessage)
    }
  }
}
