import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'

import { DidCommCredentialV2ProblemReportMessage } from '../messages/DidCommCredentialV2ProblemReportMessage'

export class DidCommCredentialV2ProblemReportHandler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV2Protocol
  public supportedMessages = [DidCommCredentialV2ProblemReportMessage]

  public constructor(credentialProtocol: DidCommCredentialV2Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommCredentialV2ProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)

    return undefined
  }
}
