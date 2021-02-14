import { Handler, HandlerInboundMessage } from '../Handler';
import { createOutboundMessage } from '../../protocols/helpers';
import { CredentialService, RequestCredentialMessage } from '../../protocols/issue-credential';

export class RequestCredentialHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [RequestCredentialMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    const credential = await this.credentialService.processRequest(messageContext);
    const { message } = await this.credentialService.createCredential(credential);
    if (!messageContext.connection) {
      throw new Error('There is no connection in message context.');
    }
    return createOutboundMessage(messageContext.connection, message);
  }
}
