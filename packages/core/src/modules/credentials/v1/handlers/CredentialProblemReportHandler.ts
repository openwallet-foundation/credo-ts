import type { V1LegacyCredentialService } from '../..'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'

import { CredentialProblemReportMessage } from '../messages'

export class CredentialProblemReportHandler implements Handler {
  private credentialService: V1LegacyCredentialService
  public supportedMessages = [CredentialProblemReportMessage]

  public constructor(credentialService: V1LegacyCredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
