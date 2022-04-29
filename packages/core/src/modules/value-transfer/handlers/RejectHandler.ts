import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'

import { RejectMessage } from '../messages/RejectMessage'

export class RejectHandler implements HandlerV2 {
  private valueTransferService: ValueTransferService
  public readonly supportedMessages = [RejectMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerV2InboundMessage<RejectHandler>) {
    await this.valueTransferService.processReject(messageContext)
  }
}
