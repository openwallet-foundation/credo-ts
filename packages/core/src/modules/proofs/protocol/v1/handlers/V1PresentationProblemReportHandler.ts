import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V1ProofService } from '../V1ProofService'

import { V1PresentationProblemReportMessage } from '../messages/V1PresentationProblemReportMessage'

export class V1PresentationProblemReportHandler implements MessageHandler {
  private proofService: V1ProofService
  public supportedMessages = [V1PresentationProblemReportMessage]

  public constructor(proofService: V1ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
