import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V2ProofService } from '../V2ProofService'

import { V2PresentationProblemReportMessage } from '../messages'

export class V2PresentationProblemReportHandler implements MessageHandler {
  private proofService: V2ProofService
  public supportedMessages = [V2PresentationProblemReportMessage]

  public constructor(proofService: V2ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
