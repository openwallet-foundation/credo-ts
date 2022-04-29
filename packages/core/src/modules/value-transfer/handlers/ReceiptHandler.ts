import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'

import { ReceiptMessage } from '../messages'

export class ReceiptHandler implements HandlerV2 {
  private valueTransferService: ValueTransferService
  public readonly supportedMessages = [ReceiptMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerV2InboundMessage<ReceiptHandler>) {
    await this.valueTransferService.processReceipt(messageContext)
    return
  }
}
