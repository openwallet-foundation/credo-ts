import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V3CredentialProtocol } from '../V3CredentialProtocol'

import { V3CredentialProblemReportMessage } from '../messages/V3CredentialProblemReportMessage'

export class V3CredentialProblemReportHandler implements MessageHandler {
  private credentialProtocol: V3CredentialProtocol
  public supportedMessages = [V3CredentialProblemReportMessage]

  public constructor(credentialProtocol: V3CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3CredentialProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)
  }
}
