import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DidCommStatusV3Message } from '../messages'

export class DidCommStatusV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommStatusV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommStatusV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processStatus(messageContext)
  }
}
