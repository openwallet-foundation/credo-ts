import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV2Protocol } from '../DidCommMessagePickupV2Protocol'

import { DidCommOutboundMessageContext } from '../../../../../models'
import { DidCommMessageDeliveryV2Message } from '../messages/DidCommMessageDeliveryV2Message'

export class DidCommMessageDeliveryV2Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessageDeliveryV2Message]
  private messagePickupService: DidCommMessagePickupV2Protocol

  public constructor(messagePickupService: DidCommMessagePickupV2Protocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommMessageDeliveryV2Message>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryReceivedMessage = await this.messagePickupService.processDelivery(messageContext)

    if (deliveryReceivedMessage) {
      return new DidCommOutboundMessageContext(deliveryReceivedMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
