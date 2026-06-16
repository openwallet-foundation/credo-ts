import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommMessagesReceivedV4Message } from '../messages'

export class DidCommMessagesReceivedV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessagesReceivedV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMessagesReceivedV4Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processMessagesReceived(messageContext)
  }
}
