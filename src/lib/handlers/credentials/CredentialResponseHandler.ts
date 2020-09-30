import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService } from '../../protocols/credentials/CredentialService';
import { CredentialResponseMessage } from '../../protocols/credentials/messages/CredentialResponseMessage';
import { LedgerService } from '../../agent/LedgerService';
import { JsonEncoder } from '../../protocols/credentials/JsonEncoder';

export class CredentialResponseHandler implements Handler {
  private credentialService: CredentialService;
  private ledgerService: LedgerService;
  public supportedMessages = [CredentialResponseMessage];

  public constructor(credentialService: CredentialService, ledgerService: LedgerService) {
    this.credentialService = credentialService;
    this.ledgerService = ledgerService;
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialResponseHandler>) {
    const [responseAttachment] = messageContext.message.attachments;
    const cred = JsonEncoder.decode(responseAttachment.data.base64);
    const [, credentialDefinition] = await this.ledgerService.getCredentialDefinition(cred.cred_def_id);
    await this.credentialService.processCredentialResponse(messageContext, credentialDefinition);
  }
}
