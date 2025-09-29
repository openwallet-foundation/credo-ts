import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV2Protocol } from '../DidCommMessagePickupV2Protocol'

import { DidCommDeliveryRequestV2Message } from '../messages'

export class DidCommDeliveryRequestV2Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommDeliveryRequestV2Message]
  private messagePickupService: DidCommMessagePickupV2Protocol

  public constructor(messagePickupService: DidCommMessagePickupV2Protocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommDeliveryRequestV2Message>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processDeliveryRequest(messageContext)
  }
}
