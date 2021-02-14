import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService, ProposeCredentialMessage } from '../../protocols/issue-credential';

export class ProposeCredentialHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [ProposeCredentialMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<ProposeCredentialHandler>) {
    await this.credentialService.processProposal(messageContext);
  }
}
