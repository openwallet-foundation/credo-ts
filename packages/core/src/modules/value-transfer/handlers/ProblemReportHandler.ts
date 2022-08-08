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
    const { message, record } = await this.valueTransferService.processProblemReport(messageContext)
    if (message && message.to?.length) {
      message.to[0] === record.getter?.did
        ? await this.valueTransferService.sendMessage(message)
        : await this.valueTransferService.sendMessage(message)
    }
  }
}
