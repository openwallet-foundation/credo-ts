import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'

import { ProblemReportMessage } from '../messages/ProblemReportMessage'

export class ProblemReportHandler implements HandlerV2 {
  private valueTransferService: ValueTransferService

  public readonly supportedMessages = [ProblemReportMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerV2InboundMessage<ProblemReportHandler>) {
    const { message, record } = await this.valueTransferService.processProblemReport(messageContext)
    if (message) {
      messageContext.message.from === record.getterDid
        ? await this.valueTransferService.sendMessageToGiver(message, record)
        : await this.valueTransferService.sendMessageToGetter(message, record)
    }
  }
}
