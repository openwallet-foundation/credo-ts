import type { MessageHandler } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'

import { V2MessagesReceivedMessage } from '../messages'

export class V2MessagesReceivedHandler implements MessageHandler {
  public supportedMessages = [V2MessagesReceivedMessage]
  private messagePickupService: V2MessagePickupProtocol

  public constructor(messagePickupService: V2MessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<V2MessagesReceivedMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processMessagesReceived(messageContext)
  }
}
