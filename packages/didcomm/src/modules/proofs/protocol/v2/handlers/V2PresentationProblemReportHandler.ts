import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DidCommProofProtocol } from '../V2DidCommProofProtocol'

import { V2PresentationProblemReportMessage } from '../messages'

export class V2PresentationProblemReportHandler implements DidCommMessageHandler {
  private proofService: V2DidCommProofProtocol
  public supportedMessages = [V2PresentationProblemReportMessage]

  public constructor(proofService: V2DidCommProofProtocol) {
    this.proofService = proofService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2PresentationProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)

    return undefined
  }
}
