import { ConnectionRecord } from '../storage/ConnectionRecord';
import { CredentialRecord } from '../storage/CredentialRecord';
import { createOutboundMessage } from '../protocols/helpers';
import { CredentialService, CredentialOfferTemplate } from '../protocols/credentials/CredentialService';
import { MessageSender } from '../agent/MessageSender';

export class CredentialsModule {
  private credentialService: CredentialService;
  private messageSender: MessageSender;

  public constructor(credentialService: CredentialService, messageSender: MessageSender) {
    this.credentialService = credentialService;
    this.messageSender = messageSender;
  }

  public async issueCredential(connection: ConnectionRecord, credentialTemplate: CredentialOfferTemplate) {
    const credentialOfferMessage = await this.credentialService.createCredentialOffer(credentialTemplate);
    const outboundMessage = createOutboundMessage(connection, credentialOfferMessage);
    await this.messageSender.sendMessage(outboundMessage);
  }

  public async acceptCredential(firstCredential: CredentialRecord) {
    throw new Error('Method not implemented.');
  }

  public async getCredentials(): Promise<CredentialRecord[]> {
    return this.credentialService.getAll();
  }

  public async find(id: string) {
    throw new Error('Method not implemented.');
  }
}

interface CredentialTemplate {
  credDefId: string;
}
