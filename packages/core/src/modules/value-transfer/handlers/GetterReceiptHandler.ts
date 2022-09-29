import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { GetterReceiptMessage } from '../messages'

export class GetterReceiptHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferGetterService: ValueTransferGetterService
  public readonly supportedMessages = [GetterReceiptMessage]

  public constructor(valueTransferGetterService: ValueTransferGetterService) {
    this.valueTransferGetterService = valueTransferGetterService
  }

  public async handle(messageContext: HandlerInboundMessage<GetterReceiptHandler>) {
    await this.valueTransferGetterService.processReceipt(messageContext)
  }
}
