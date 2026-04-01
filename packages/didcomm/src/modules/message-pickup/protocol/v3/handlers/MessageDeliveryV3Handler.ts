import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { MessageDeliveryV3Message } from '../messages'

export class MessageDeliveryV3Handler implements DidCommMessageHandler {
  public supportedMessages = [MessageDeliveryV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MessageDeliveryV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processDelivery(messageContext)
  }
}
