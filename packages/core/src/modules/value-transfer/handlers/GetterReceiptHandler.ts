import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { GetterReceiptMessage } from '../messages'

export class GetterReceiptHandler implements HandlerV2 {
  private valueTransferGetterService: ValueTransferGetterService
  public readonly supportedMessages = [GetterReceiptMessage]

  public constructor(valueTransferGetterService: ValueTransferGetterService) {
    this.valueTransferGetterService = valueTransferGetterService
  }

  public async handle(messageContext: HandlerV2InboundMessage<GetterReceiptHandler>) {
    await this.valueTransferGetterService.processReceipt(messageContext)
    return
  }
}
