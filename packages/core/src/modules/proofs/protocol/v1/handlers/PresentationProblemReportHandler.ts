import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1LegacyProofService } from '../V1LegacyProofService'

import { PresentationProblemReportMessage } from '../messages'

export class PresentationProblemReportHandler implements Handler {
  private proofService: V1LegacyProofService
  public supportedMessages = [PresentationProblemReportMessage]

  public constructor(proofService: V1LegacyProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
