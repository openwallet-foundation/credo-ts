import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DidCommStatusRequestV3Message } from '../messages'

export class DidCommStatusRequestV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommStatusRequestV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommStatusRequestV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processStatusRequest(messageContext)
  }
}
