import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V2CredentialService } from '../V2CredentialService'

import { V2CredentialProblemReportMessage } from '../messages/V2CredentialProblemReportMessage'

export class V2CredentialProblemReportHandler implements Handler {
  private credentialService: V2CredentialService
  public supportedMessages = [V2CredentialProblemReportMessage]

  public constructor(credentialService: V2CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<V2CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
