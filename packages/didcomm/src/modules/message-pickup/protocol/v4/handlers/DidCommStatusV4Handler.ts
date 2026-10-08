import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommStatusV4Message } from '../messages'

export class DidCommStatusV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommStatusV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommStatusV4Handler>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryRequestMessage = await this.protocol.processStatus(messageContext)

    if (deliveryRequestMessage) {
      return new DidCommOutboundMessageContext(deliveryRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
