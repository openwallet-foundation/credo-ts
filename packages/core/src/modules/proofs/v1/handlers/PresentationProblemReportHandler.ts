import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { ProofService } from '../../ProofService'

import { PresentationProblemReportMessage } from '../messages'

export class PresentationProblemReportHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [PresentationProblemReportMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
