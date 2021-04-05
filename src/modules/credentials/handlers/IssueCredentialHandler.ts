import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { CredentialService } from '../services'
import { IssueCredentialMessage } from '../messages'

export class IssueCredentialHandler implements Handler {
  private credentialService: CredentialService
  public supportedMessages = [IssueCredentialMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
    await this.credentialService.processCredential(messageContext)
  }
}
