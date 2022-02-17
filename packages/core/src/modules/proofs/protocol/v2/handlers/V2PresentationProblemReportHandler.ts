import type { V2ProofService } from '..'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'

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
