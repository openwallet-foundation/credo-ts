import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupService } from '../V2MessagePickupService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { MessageDeliveryMessage } from '../messages/MessageDeliveryMessage'

export class DeliveryHandler implements Handler {
  public supportedMessages = [MessageDeliveryMessage]
  private messagePickupService: V2MessagePickupService

  public constructor(messagePickupService: V2MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<MessageDeliveryMessage>) {
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
