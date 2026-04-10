import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { MessageDeliveryV3Message } from '../messages'

export class MessageDeliveryV3Handler implements DidCommMessageHandler {
  public supportedMessages = [MessageDeliveryV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MessageDeliveryV3Handler>) {
    const connection = messageContext.assertReadyConnection()
    // processDelivery emits the inner messages and returns a MessagesReceivedV3Message
    // that must be sent back to the mediator so it can dequeue the delivered messages.
    // Without this, the mediator re-delivers the same messages on every pickup cycle.
    const messagesReceived = await this.protocol.processDelivery(messageContext)
    return new DidCommOutboundMessageContext(messagesReceived, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }
}
