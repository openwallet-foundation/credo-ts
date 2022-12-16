import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V2CredentialService } from '../V2CredentialService'

import { V2CredentialProblemReportMessage } from '../messages/V2CredentialProblemReportMessage'

export class V2CredentialProblemReportHandler implements MessageHandler {
  private credentialService: V2CredentialService
  public supportedMessages = [V2CredentialProblemReportMessage]

  public constructor(credentialService: V2CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
