import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1CredentialProtocol } from '../V1CredentialProtocol'

import { V1CredentialProblemReportMessage } from '../messages'

export class V1CredentialProblemReportHandler implements Handler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1CredentialProblemReportMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: HandlerInboundMessage<V1CredentialProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)
  }
}
