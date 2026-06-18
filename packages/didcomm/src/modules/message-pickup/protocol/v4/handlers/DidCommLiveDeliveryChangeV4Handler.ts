import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommLiveDeliveryChangeV4Message } from '../messages'

export class DidCommLiveDeliveryChangeV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommLiveDeliveryChangeV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommLiveDeliveryChangeV4Handler>) {
    messageContext.assertReadyConnection()
    return this.protocol.processLiveDeliveryChange(messageContext)
  }
}
