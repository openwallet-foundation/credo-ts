import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService, IssueCredentialMessage } from '../../protocols/issue-credential';

export class IssueCredentialHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [IssueCredentialMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
    await this.credentialService.processCredential(messageContext);
  }
}
