import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import { DidCommLiveDeliveryChangeV3Message } from '../messages'

export class DidCommLiveDeliveryChangeV3Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommLiveDeliveryChangeV3Message]
  private protocol: DidCommMessagePickupV3Protocol

  public constructor(protocol: DidCommMessagePickupV3Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommLiveDeliveryChangeV3Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processLiveDeliveryChange(messageContext)
  }
}
