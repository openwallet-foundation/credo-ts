import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V2CredentialProtocol } from '../V2CredentialProtocol'

import { V2CredentialProblemReportMessage } from '../messages/V2CredentialProblemReportMessage'

export class V2CredentialProblemReportHandler implements Handler {
  private credentialProtocol: V2CredentialProtocol
  public supportedMessages = [V2CredentialProblemReportMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: HandlerInboundMessage<V2CredentialProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)
  }
}
