import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupService } from '../V2MessagePickupService'

import { DeliveryRequestMessage } from '../messages'

export class DeliveryRequestHandler implements Handler {
  public supportedMessages = [DeliveryRequestMessage]
  private messagePickupService: V2MessagePickupService

  public constructor(messagePickupService: V2MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<DeliveryRequestMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processDeliveryRequest(messageContext)
  }
}
