import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DidCommDeliveryRequestV3Message } from '../messages'

export class DidCommDeliveryRequestV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommDeliveryRequestV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommDeliveryRequestV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processDeliveryRequest(messageContext)
  }
}
