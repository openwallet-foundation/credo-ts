import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { CashAcceptedMessage } from '../messages'

export class CashAcceptedHandler implements Handler {
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [CashAcceptedMessage]

  public constructor(valueTransferWitnessService: ValueTransferWitnessService) {
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<CashAcceptedHandler>) {
    await this.valueTransferWitnessService.processCashAcceptance(messageContext)
  }
}
