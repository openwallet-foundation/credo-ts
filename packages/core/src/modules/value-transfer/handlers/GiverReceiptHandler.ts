import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { GiverReceiptMessage } from '../messages'

export class GiverReceiptHandler implements HandlerV2 {
  private valueTransferGiverService: ValueTransferGiverService
  public readonly supportedMessages = [GiverReceiptMessage]

  public constructor(valueTransferGiverService: ValueTransferGiverService) {
    this.valueTransferGiverService = valueTransferGiverService
  }

  public async handle(messageContext: HandlerV2InboundMessage<GiverReceiptHandler>) {
    await this.valueTransferGiverService.processReceipt(messageContext)
  }
}
