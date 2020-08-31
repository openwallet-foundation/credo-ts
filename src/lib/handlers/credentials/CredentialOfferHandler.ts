import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService } from '../../protocols/credentials/CredentialService';
import { CredentialOfferMessage } from '../../protocols/credentials/messages/CredentialOfferMessage';

export class CredentialOfferHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [CredentialOfferMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialOfferHandler>) {
    const outboudMessage = await this.credentialService.processCredentialOffer(messageContext);
    return outboudMessage;
  }
}
