import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1ProofService } from '../V1ProofService'

import { V1PresentationProblemReportMessage } from '../messages/V1PresentationProblemReportMessage'

export class V1PresentationProblemReportHandler implements Handler {
  private proofService: V1ProofService
  public supportedMessages = [V1PresentationProblemReportMessage]

  public constructor(proofService: V1ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<V1PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
