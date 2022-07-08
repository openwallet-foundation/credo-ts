import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { OfferMessage, ProblemReportMessage } from '../messages'

export class OfferHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [OfferMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<OfferHandler>) {
    const { message } = await this.valueTransferWitnessService.processOffer(messageContext)
    if (message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToGiver(message)
    }
    return this.valueTransferService.sendMessageToGetter(message)
  }
}
