import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofV2Protocol } from '../DidCommProofV2Protocol'

import { DidCommPresentationV2ProblemReportMessage } from '../messages'

export class DidCommPresentationV2ProblemReportHandler implements DidCommMessageHandler {
  private proofService: DidCommProofV2Protocol
  public supportedMessages = [DidCommPresentationV2ProblemReportMessage]

  public constructor(proofService: DidCommProofV2Protocol) {
    this.proofService = proofService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV2ProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)

    return undefined
  }
}
