import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessagePickupService } from '../MessagePickupService'

import { BatchPickupMessage } from '../messages'

export class BatchPickupHandler implements Handler {
  private messagePickupService: MessagePickupService
  public supportedMessages = [BatchPickupMessage]

  public constructor(messagePickupService: MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: HandlerInboundMessage<BatchPickupHandler>) {
    messageContext.assertReadyConnection()

    return this.messagePickupService.batch(messageContext)
  }
}
