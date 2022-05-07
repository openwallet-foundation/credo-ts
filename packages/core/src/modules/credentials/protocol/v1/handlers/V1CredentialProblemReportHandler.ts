import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1CredentialService } from '../V1CredentialService'

import { V1CredentialProblemReportMessage } from '../messages'

export class V1CredentialProblemReportHandler implements Handler {
  private credentialService: V1CredentialService
  public supportedMessages = [V1CredentialProblemReportMessage]

  public constructor(credentialService: V1CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<V1CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
