import { Handler, HandlerInboundMessage } from '../Handler';
import { CredentialService } from '../../protocols/credentials/CredentialService';
import { CredentialResponseMessage } from '../../protocols/credentials/messages/CredentialResponseMessage';
import { LedgerService } from '../../agent/LedgerService';
import { JsonEncoder } from '../../utils/JsonEncoder';
import { createOutboundMessage } from '../../protocols/helpers';

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

    if (!responseAttachment.data.base64) {
      throw new Error('Missing required base64 encoded attachment data');
    }

    const cred = JsonEncoder.fromBase64(responseAttachment.data.base64);
    const credentialDefinition = await this.ledgerService.getCredentialDefinition(cred.cred_def_id);
    const credential = await this.credentialService.processResponse(messageContext, credentialDefinition);

    if (messageContext.message.requiresAck()) {
      if (!messageContext.connection) {
        throw new Error('There is no connection in message context.');
      }
      const message = await this.credentialService.createAck(credential.id);
      return createOutboundMessage(messageContext.connection, message);
    }
  }
}
