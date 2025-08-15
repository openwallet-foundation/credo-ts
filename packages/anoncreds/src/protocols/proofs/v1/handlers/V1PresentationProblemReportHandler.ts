import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { V1ProofProtocol } from '../V1ProofProtocol'

import { V1PresentationProblemReportMessage } from '../messages/V1PresentationProblemReportMessage'

export class V1PresentationProblemReportHandler implements DidCommMessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1PresentationProblemReportMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1PresentationProblemReportHandler>) {
    await this.proofProtocol.processProblemReport(messageContext)

    return undefined
  }
}
