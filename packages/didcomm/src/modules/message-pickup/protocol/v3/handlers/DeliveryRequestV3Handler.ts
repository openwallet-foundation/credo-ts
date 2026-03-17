import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DeliveryRequestV3Message } from '../messages'

export class DeliveryRequestV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DeliveryRequestV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DeliveryRequestV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processDeliveryRequest(messageContext)
  }
}
