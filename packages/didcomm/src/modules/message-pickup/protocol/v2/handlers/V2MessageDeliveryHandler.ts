import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { V2DidCommMessagePickupProtocol } from '../V2DidCommMessagePickupProtocol'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V2MessageDeliveryMessage } from '../messages/V2MessageDeliveryMessage'

export class V2MessageDeliveryHandler implements DidCommMessageHandler {
  public supportedMessages = [V2MessageDeliveryMessage]
  private messagePickupService: V2DidCommMessagePickupProtocol

  public constructor(messagePickupService: V2DidCommMessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2MessageDeliveryMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryReceivedMessage = await this.messagePickupService.processDelivery(messageContext)

    if (deliveryReceivedMessage) {
      return new OutboundDidCommMessageContext(deliveryReceivedMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
