import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommDeliveryRequestV4Message } from '../messages'

export class DidCommDeliveryRequestV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommDeliveryRequestV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommDeliveryRequestV4Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processDeliveryRequest(messageContext)
  }
}
