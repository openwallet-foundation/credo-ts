import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'

import { V2LiveDeliveryChangeMessage } from '../messages'

export class V2LiveDeliveryChangeHandler implements DidCommMessageHandler {
  public supportedMessages = [V2LiveDeliveryChangeMessage]
  private messagePickupService: V2MessagePickupProtocol

  public constructor(messagePickupService: V2MessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2LiveDeliveryChangeMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processLiveDeliveryChange(messageContext)
  }
}
