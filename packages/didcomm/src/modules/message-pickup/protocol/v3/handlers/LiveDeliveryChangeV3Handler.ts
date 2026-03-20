import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { LiveDeliveryChangeV3Message } from '../messages'

export class LiveDeliveryChangeV3Handler implements DidCommMessageHandler {
  public supportedMessages = [LiveDeliveryChangeV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<LiveDeliveryChangeV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processLiveDeliveryChange(messageContext)
  }
}
