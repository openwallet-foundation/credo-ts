import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V2ProofService } from '../V2ProofService'

import { V2PresentationProblemReportMessage } from '../messages'

export class V2PresentationProblemReportHandler implements Handler {
  private proofService: V2ProofService
  public supportedMessages = [V2PresentationProblemReportMessage]

  public constructor(proofService: V2ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<V2PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
