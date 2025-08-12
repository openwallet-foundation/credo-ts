import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DidCommCredentialProtocol } from '../V2DidCommCredentialProtocol'

import { V2CredentialProblemReportMessage } from '../messages/V2CredentialProblemReportMessage'

export class V2CredentialProblemReportHandler implements DidCommMessageHandler {
  private credentialProtocol: V2DidCommCredentialProtocol
  public supportedMessages = [V2CredentialProblemReportMessage]

  public constructor(credentialProtocol: V2DidCommCredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2CredentialProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)

    return undefined
  }
}
