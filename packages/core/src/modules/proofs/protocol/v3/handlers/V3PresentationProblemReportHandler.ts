import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V3ProofProtocol } from '../V3ProofProtocol'

import { V3PresentationProblemReportMessage } from '../messages'

export class V3PresentationProblemReportHandler implements MessageHandler {
  private proofService: V3ProofProtocol
  public supportedMessages = [V3PresentationProblemReportMessage]

  public constructor(proofService: V3ProofProtocol) {
    this.proofService = proofService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)
  }
}
