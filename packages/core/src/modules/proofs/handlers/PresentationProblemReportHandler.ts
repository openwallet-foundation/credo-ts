import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { ProofService } from '../services'

import { PresentationProblemReportMessage } from '../messages'

export class PresentationProblemReportHandler implements Handler<typeof DIDCommV1Message> {
  private proofService: ProofService
  public supportedMessages = [PresentationProblemReportMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
