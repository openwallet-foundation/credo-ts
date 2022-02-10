import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { ProofService } from '../../../ProofService'

import { V1PresentationProblemReportMessage } from '../messages'

export class V1PresentationProblemReportHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [V1PresentationProblemReportMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<V1PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
