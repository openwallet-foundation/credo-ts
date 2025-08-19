import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { V2DidCommMessagePickupProtocol } from '../V2DidCommMessagePickupProtocol'

import { V2MessagesReceivedMessage } from '../messages'

export class V2MessagesReceivedHandler implements DidCommMessageHandler {
  public supportedMessages = [V2MessagesReceivedMessage]
  private messagePickupService: V2DidCommMessagePickupProtocol

  public constructor(messagePickupService: V2DidCommMessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2MessagesReceivedMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processMessagesReceived(messageContext)
  }
}
