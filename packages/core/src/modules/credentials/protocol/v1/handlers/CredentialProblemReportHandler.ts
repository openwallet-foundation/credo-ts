import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1CredentialService } from '../V1CredentialService'

import { CredentialProblemReportMessage } from '../messages'

export class CredentialProblemReportHandler implements Handler {
  private credentialService: V1CredentialService
  public supportedMessages = [CredentialProblemReportMessage]

  public constructor(credentialService: V1CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
