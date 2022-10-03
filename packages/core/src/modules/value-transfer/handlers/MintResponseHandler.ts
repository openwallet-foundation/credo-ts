import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { ValueTransferIssuerService } from '../services/ValueTransferIssuerService'

import { MintResponseMessage } from '../messages/MintResponseMessage'

export class MintResponseHandler implements Handler {
  private valueTransferIssuerService: ValueTransferIssuerService
  public readonly supportedMessages = [MintResponseMessage]

  public constructor(valueTransferIssuerService: ValueTransferIssuerService) {
    this.valueTransferIssuerService = valueTransferIssuerService
  }

  public async handle(messageContext: HandlerInboundMessage<MintResponseHandler>) {
    await this.valueTransferIssuerService.processCashMintResponse(messageContext)
  }
}
