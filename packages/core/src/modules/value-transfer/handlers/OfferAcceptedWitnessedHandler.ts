import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { OfferAcceptedWitnessedMessage, ProblemReportMessage } from '../messages'

export class OfferAcceptedWitnessedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferGiverService: ValueTransferGiverService

  public readonly supportedMessages = [OfferAcceptedWitnessedMessage]

  public constructor(valueTransferService: ValueTransferService, valueTransferGiverService: ValueTransferGiverService) {
    this.valueTransferService = valueTransferService
    this.valueTransferGiverService = valueTransferGiverService
  }

  public async handle(messageContext: HandlerInboundMessage<OfferAcceptedWitnessedHandler>) {
    const { message, record } = await this.valueTransferGiverService.processOfferAcceptanceWitnessed(messageContext)
    if (!message) return

    await this.valueTransferService.sendMessage(message)

    // if message is Problem Report -> remove cash from the wallet
    if (message.type !== ProblemReportMessage.type) {
      await this.valueTransferGiverService.removeCash(record)
      return
    }
  }
}
