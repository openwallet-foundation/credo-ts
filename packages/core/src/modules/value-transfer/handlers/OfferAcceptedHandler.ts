import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { OfferAcceptedMessage, ProblemReportMessage } from '../messages'

export class OfferAcceptedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [OfferAcceptedMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<OfferAcceptedHandler>) {
    const { record, message } = await this.valueTransferWitnessService.processOfferAcceptance(messageContext)

    // if message is Problem Report -> also send it to Giver as well
    if (message.type === ProblemReportMessage.type) {
      await this.valueTransferService.sendProblemReportToGetterAndGiver(message, record)
      return
    }

    // send success message to Giver
    await this.valueTransferService.sendMessageToGiver(message)
  }
}
