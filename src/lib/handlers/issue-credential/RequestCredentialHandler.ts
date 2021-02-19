import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService, RequestCredentialMessage } from '../../protocols/issue-credential';

export class RequestCredentialHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [RequestCredentialMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    this.credentialService.processRequest(messageContext);
  }
}
