import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DidCommProofV1Protocol } from '../DidCommProofV1Protocol'

import { DidCommPresentationV1ProblemReportMessage } from '../messages/DidCommPresentationV1ProblemReportMessage'

export class DidCommPresentationV1ProblemReportHandler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofV1Protocol
  public supportedMessages = [DidCommPresentationV1ProblemReportMessage]

  public constructor(proofProtocol: DidCommProofV1Protocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV1ProblemReportHandler>) {
    await this.proofProtocol.processProblemReport(messageContext)

    return undefined
  }
}
