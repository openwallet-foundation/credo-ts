import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DidCommMessagesReceivedV3Message } from '../messages'

export class DidCommMessagesReceivedV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessagesReceivedV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMessagesReceivedV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processMessagesReceived(messageContext)
  }
}
