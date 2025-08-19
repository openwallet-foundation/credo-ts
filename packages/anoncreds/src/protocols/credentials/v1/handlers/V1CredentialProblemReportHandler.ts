import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { V1CredentialProtocol } from '../V1DidCommCredentialProtocol'

import { V1CredentialProblemReportMessage } from '../messages'

export class V1CredentialProblemReportHandler implements DidCommMessageHandler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1CredentialProblemReportMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1CredentialProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)

    return undefined
  }
}
