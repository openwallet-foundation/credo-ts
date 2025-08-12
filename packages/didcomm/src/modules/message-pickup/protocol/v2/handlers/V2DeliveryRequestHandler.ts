import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'

import { V2DeliveryRequestMessage } from '../messages'

export class V2DeliveryRequestHandler implements DidCommMessageHandler {
  public supportedMessages = [V2DeliveryRequestMessage]
  private messagePickupService: V2MessagePickupProtocol

  public constructor(messagePickupService: V2MessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2DeliveryRequestMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processDeliveryRequest(messageContext)
  }
}
