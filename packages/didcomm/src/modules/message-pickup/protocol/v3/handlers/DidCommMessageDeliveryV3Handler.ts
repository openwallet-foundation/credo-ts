import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DidCommMessageDeliveryV3Message } from '../messages'

export class DidCommMessageDeliveryV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessageDeliveryV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMessageDeliveryV3Handler>) {
    const connection = messageContext.assertReadyConnection()
    // processDelivery emits the inner messages and returns a DidCommMessagesReceivedV3Message
    // that must be sent back to the mediator so it can dequeue the delivered messages.
    // Without this, the mediator re-delivers the same messages on every pickup cycle.
    const messagesReceived = await this.protocol.processDelivery(messageContext)
    return new DidCommOutboundMessageContext(messagesReceived, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }
}
