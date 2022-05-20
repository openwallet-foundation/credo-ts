import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'

export class ProblemReportHandler implements HandlerV2 {
  private valueTransferService: ValueTransferService
  public readonly supportedMessages = [ProblemReportMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerV2InboundMessage<ProblemReportHandler>) {
    const { forward } = await this.valueTransferService.processProblemReport(messageContext)
    if (forward) {
      return createOutboundMessage(forward.connection, forward.message)
    }
  }
}
