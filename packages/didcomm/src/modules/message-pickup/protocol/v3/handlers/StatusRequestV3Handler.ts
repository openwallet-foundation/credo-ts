import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { StatusRequestV3Message } from '../messages'

export class StatusRequestV3Handler implements DidCommMessageHandler {
  public supportedMessages = [StatusRequestV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<StatusRequestV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processStatusRequest(messageContext)
  }
}
