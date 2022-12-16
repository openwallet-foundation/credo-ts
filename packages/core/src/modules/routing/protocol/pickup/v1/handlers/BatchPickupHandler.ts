import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { MessagePickupService } from '../MessagePickupService'

import { BatchPickupMessage } from '../messages'

export class BatchPickupHandler implements MessageHandler {
  private messagePickupService: MessagePickupService
  public supportedMessages = [BatchPickupMessage]

  public constructor(messagePickupService: MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<BatchPickupHandler>) {
    messageContext.assertReadyConnection()

    return this.messagePickupService.batch(messageContext)
  }
}
