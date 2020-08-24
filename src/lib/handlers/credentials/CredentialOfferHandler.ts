import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService } from '../../protocols/credentials/CredentialService';
import { CredentialOfferMessage } from '../../protocols/credentials/messages/CredentialOfferMessage';

export class CredentialOfferHandler implements Handler {
  credentialService: CredentialService;
  supportedMessages = [CredentialOfferMessage];

  constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  async handle(messageContext: HandlerInboundMessage<CredentialOfferHandler>) {
    const outboudMessage = await this.credentialService.acceptCredentialOffer(messageContext);
    return outboudMessage;
  }
}
