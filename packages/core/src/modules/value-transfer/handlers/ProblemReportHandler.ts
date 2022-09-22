import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'

import { ProblemReportMessage } from '../messages/ProblemReportMessage'

export class ProblemReportHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService

  public readonly supportedMessages = [ProblemReportMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerInboundMessage<ProblemReportHandler>) {
    await this.valueTransferService.processProblemReport(messageContext)
  }
}
