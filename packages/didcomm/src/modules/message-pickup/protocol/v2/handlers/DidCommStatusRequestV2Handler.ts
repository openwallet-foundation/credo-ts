import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV2Protocol } from '../DidCommMessagePickupV2Protocol'

import { DidCommStatusRequestV2Message } from '../messages'

export class DidCommStatusRequestV2Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommStatusRequestV2Message]
  private messagePickupService: DidCommMessagePickupV2Protocol

  public constructor(messagePickupService: DidCommMessagePickupV2Protocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommStatusRequestV2Message>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processStatusRequest(messageContext)
  }
}
