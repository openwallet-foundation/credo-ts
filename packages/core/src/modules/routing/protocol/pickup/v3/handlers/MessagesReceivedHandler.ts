import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V3MessagePickupService } from '../V3MessagePickupService'

import { MessagesReceivedMessage } from '../messages'

export class MessagesReceivedHandler implements Handler {
  public supportedMessages = [MessagesReceivedMessage]
  private messagePickupService: V3MessagePickupService

  public constructor(messagePickupService: V3MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<MessagesReceivedMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processMessagesReceived(messageContext)
  }
}
