import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { ValueTransferService } from '../services'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'

export class ProblemReportHandler implements HandlerV2 {
  private valueTransferService: ValueTransferService
  private messageSender: MessageSender

  public readonly supportedMessages = [ProblemReportMessage]

  public constructor(valueTransferService: ValueTransferService, messageSender: MessageSender) {
    this.valueTransferService = valueTransferService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<ProblemReportHandler>) {
    const { forward } = await this.valueTransferService.processProblemReport(messageContext)
    if (forward) {
      const outboundMessage = createOutboundDIDCommV2Message(forward.message)
      await this.messageSender.sendDIDCommV2Message(outboundMessage, forward.transport)
    }
  }
}
