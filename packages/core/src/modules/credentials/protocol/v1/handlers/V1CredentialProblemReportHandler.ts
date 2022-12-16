import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V1CredentialService } from '../V1CredentialService'

import { V1CredentialProblemReportMessage } from '../messages'

export class V1CredentialProblemReportHandler implements MessageHandler {
  private credentialService: V1CredentialService
  public supportedMessages = [V1CredentialProblemReportMessage]

  public constructor(credentialService: V1CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
