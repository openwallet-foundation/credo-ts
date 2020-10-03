import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService } from '../../protocols/credentials/CredentialService';
import { CredentialRequestMessage } from '../../protocols/credentials/messages/CredentialRequestMessage';
import { createOutboundMessage } from '../../protocols/helpers';

export class CredentialRequestHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [CredentialRequestMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialRequestHandler>) {
    const credential = await this.credentialService.processCredentialRequest(messageContext);
    const message = await this.credentialService.createCredentialResponse(credential.id, { comment: '' });
    if (!messageContext.connection) {
      throw new Error('There is no connection in message context.');
    }
    return createOutboundMessage(messageContext.connection, message);
  }
}
