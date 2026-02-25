import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV2Protocol } from '../DidCommMessagePickupV2Protocol'

import { DidCommMessagesReceivedV2Message } from '../messages'

export class DidCommMessagesReceivedV2Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessagesReceivedV2Message]
  private messagePickupService: DidCommMessagePickupV2Protocol

  public constructor(messagePickupService: DidCommMessagePickupV2Protocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommMessagesReceivedV2Message>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processMessagesReceived(messageContext)
  }
}
