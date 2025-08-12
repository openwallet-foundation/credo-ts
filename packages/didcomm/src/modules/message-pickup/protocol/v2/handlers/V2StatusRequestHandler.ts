import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'

import { V2StatusRequestMessage } from '../messages'

export class V2StatusRequestHandler implements DidCommMessageHandler {
  public supportedMessages = [V2StatusRequestMessage]
  private messagePickupService: V2MessagePickupProtocol

  public constructor(messagePickupService: V2MessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2StatusRequestMessage>) {
    messageContext.assertReadyConnection()
    return this.messagePickupService.processStatusRequest(messageContext)
  }
}
