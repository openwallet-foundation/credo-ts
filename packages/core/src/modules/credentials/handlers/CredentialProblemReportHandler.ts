import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { CredentialProblemReportMessage } from '../messages'

export class CredentialProblemReportHandler implements Handler {
  private credentialService: CredentialService
  public supportedMessages = [CredentialProblemReportMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
