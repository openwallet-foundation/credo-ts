import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommMessageDeliveryV4Message } from '../messages'

export class DidCommMessageDeliveryV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessageDeliveryV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMessageDeliveryV4Handler>) {
    const connection = messageContext.assertReadyConnection()
    // processDelivery emits the inner messages and returns a DidCommMessagesReceivedV4Message
    // that must be sent back to the mediator so it can dequeue the delivered messages.
    // Without this, the mediator re-delivers the same messages on every pickup cycle.
    const messagesReceived = await this.protocol.processDelivery(messageContext)
    if (messagesReceived) {
      return new DidCommOutboundMessageContext(messagesReceived, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
