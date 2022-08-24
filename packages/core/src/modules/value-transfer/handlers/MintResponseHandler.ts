import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferIssuerService } from '../services/ValueTransferIssuerService'

import { MintResponseMessage } from '../messages/MintResponseMessage'

export class MintResponseHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferIssuerService: ValueTransferIssuerService
  public readonly supportedMessages = [MintResponseMessage]

  public constructor(valueTransferIssuerService: ValueTransferIssuerService) {
    this.valueTransferIssuerService = valueTransferIssuerService
  }

  public async handle(messageContext: HandlerInboundMessage<MintResponseHandler>) {
    await this.valueTransferIssuerService.processCashMintResponse(messageContext)
  }
}
