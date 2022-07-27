import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { RequestAcceptedMessage } from '../messages'

export class RequestAcceptedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [RequestAcceptedMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestAcceptedHandler>) {
    const { record, message, problemReport } = await this.valueTransferWitnessService.processRequestAcceptance(
      messageContext
    )

    // if message is Problem Report -> also send it to Giver as well
    if (problemReport) {
      await this.valueTransferService.sendProblemReportToGetterAndGiver(problemReport, record)
      return
    }

    if (message) {
      // send success message to Getter
      await this.valueTransferService.sendMessageToGetter(message)
      return
    }
  }
}
