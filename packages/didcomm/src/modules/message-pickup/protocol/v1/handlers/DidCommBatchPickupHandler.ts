import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV1Protocol } from '../DidCommMessagePickupV1Protocol'

import { DidCommBatchPickupMessage } from '../messages'

export class DidCommBatchPickupHandler implements DidCommMessageHandler {
  private messagePickupService: DidCommMessagePickupV1Protocol
  public supportedMessages = [DidCommBatchPickupMessage]

  public constructor(messagePickupService: DidCommMessagePickupV1Protocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommBatchPickupHandler>) {
    messageContext.assertReadyConnection()

    return this.messagePickupService.processBatchPickup(messageContext)
  }
}
