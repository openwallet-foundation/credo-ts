import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { CredentialService } from '../services'

import { CredentialProblemReportMessage } from '../messages'

export class CredentialProblemReportHandler implements Handler<typeof DIDCommV1Message> {
  private credentialService: CredentialService
  public supportedMessages = [CredentialProblemReportMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialProblemReportHandler>) {
    await this.credentialService.processProblemReport(messageContext)
  }
}
