import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DidCommProofProtocol } from '../DidCommProofV2Protocol'

import { DidCommPresentationV2ProblemReportMessage } from '../messages'

export class DidCommPresentationV2ProblemReportHandler implements DidCommMessageHandler {
  private proofService: V2DidCommProofProtocol
  public supportedMessages = [DidCommPresentationV2ProblemReportMessage]

  public constructor(proofService: V2DidCommProofProtocol) {
    this.proofService = proofService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV2ProblemReportHandler>) {
    await this.proofService.processProblemReport(messageContext)

    return undefined
  }
}
