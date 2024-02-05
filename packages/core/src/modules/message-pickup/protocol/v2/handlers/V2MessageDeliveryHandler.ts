import type { MessageHandler } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { V2MessageDeliveryMessage } from '../messages/V2MessageDeliveryMessage'

export class V2MessageDeliveryHandler implements MessageHandler {
  public supportedMessages = [V2MessageDeliveryMessage]
  private messagePickupService: V2MessagePickupProtocol

  public constructor(messagePickupService: V2MessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<V2MessageDeliveryMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryReceivedMessage = await this.messagePickupService.processDelivery(messageContext)

    if (deliveryReceivedMessage) {
      return new OutboundMessageContext(deliveryReceivedMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
