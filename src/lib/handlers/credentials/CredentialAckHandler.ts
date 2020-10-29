import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService } from '../../protocols/credentials/CredentialService';
import { CredentialAckMessage } from '../../protocols/credentials/messages/CredentialAckMessage';

export class CredentialAckHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [CredentialAckMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext);
  }
}
