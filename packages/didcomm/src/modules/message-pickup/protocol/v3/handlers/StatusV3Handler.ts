import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { StatusV3Message } from '../messages'

export class StatusV3Handler implements DidCommMessageHandler {
  public supportedMessages = [StatusV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<StatusV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processStatus(messageContext)
  }
}
