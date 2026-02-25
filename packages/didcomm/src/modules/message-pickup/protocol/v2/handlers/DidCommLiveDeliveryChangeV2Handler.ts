import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV2Protocol } from '../DidCommMessagePickupV2Protocol'

import { DidCommLiveDeliveryChangeV2Message } from '../messages'

export class DidCommLiveDeliveryChangeV2Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommLiveDeliveryChangeV2Message]
  private messagePickupService: DidCommMessagePickupV2Protocol

  public constructor(messagePickupService: DidCommMessagePickupV2Protocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommLiveDeliveryChangeV2Message>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processLiveDeliveryChange(messageContext)
  }
}
