import { ConnectionRecord } from '../storage/ConnectionRecord';
import { CredentialRecord } from '../storage/CredentialRecord';
import { createOutboundMessage } from '../protocols/helpers';
import { CredentialService, CredentialOfferTemplate } from '../protocols/credentials/CredentialService';
import { MessageSender } from '../agent/MessageSender';

export class CredentialsModule {
  credentialService: CredentialService;
  messageSender: MessageSender;

  constructor(credentialService: CredentialService, messageSender: MessageSender) {
    this.credentialService = credentialService;
    this.messageSender = messageSender;
  }

  async issueCredential(connection: ConnectionRecord, credentialTemplate: CredentialOfferTemplate) {
    const credentialOfferMessage = await this.credentialService.createCredentialOffer(credentialTemplate);
    const outboundMessage = createOutboundMessage(connection, credentialOfferMessage);
    await this.messageSender.sendMessage(outboundMessage);
  }

  async getCredentials(): Promise<CredentialRecord[]> {
    return this.credentialService.getAll();
  }
}

interface CredentialTemplate {
  credDefId: string;
}
