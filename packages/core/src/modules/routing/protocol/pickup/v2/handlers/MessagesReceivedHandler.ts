import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupService } from '../V2MessagePickupService'

import { MessagesReceivedMessage } from '../messages'

export class MessagesReceivedHandler implements Handler {
  public supportedMessages = [MessagesReceivedMessage]
  private messagePickupService: V2MessagePickupService

  public constructor(messagePickupService: V2MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<MessagesReceivedMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processMessagesReceived(messageContext)
  }
}
