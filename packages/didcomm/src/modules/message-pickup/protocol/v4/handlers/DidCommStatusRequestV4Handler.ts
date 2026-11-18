import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommStatusRequestV4Message } from '../messages'

export class DidCommStatusRequestV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommStatusRequestV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommStatusRequestV4Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processStatusRequest(messageContext)
  }
}
