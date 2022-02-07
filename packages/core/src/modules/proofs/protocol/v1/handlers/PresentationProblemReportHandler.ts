import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1LegacyProofService } from '../V1LegacyProofService'

import { V1PresentationProblemReportMessage } from '../messages'

export class PresentationProblemReportHandler implements Handler {
  private proofService: V1LegacyProofService
  public supportedMessages = [V1PresentationProblemReportMessage]

  public constructor(proofService: V1LegacyProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
