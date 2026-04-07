import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { MessagesReceivedV3Message } from '../messages'

export class MessagesReceivedV3Handler implements DidCommMessageHandler {
  public supportedMessages = [MessagesReceivedV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MessagesReceivedV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processMessagesReceived(messageContext)
  }
}
