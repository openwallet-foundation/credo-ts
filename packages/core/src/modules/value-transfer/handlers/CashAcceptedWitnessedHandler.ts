import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { CashAcceptedWitnessedMessage } from '../messages'

export class CashAcceptedWitnessedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferGiverService: ValueTransferGiverService

  public readonly supportedMessages = [CashAcceptedWitnessedMessage]

  public constructor(valueTransferGiverService: ValueTransferGiverService) {
    this.valueTransferGiverService = valueTransferGiverService
  }

  public async handle(messageContext: HandlerInboundMessage<CashAcceptedWitnessedHandler>) {
    await this.valueTransferGiverService.processCashAcceptanceWitnessed(messageContext)
  }
}
