import { ConnectionRecord } from '../storage/ConnectionRecord';
import { CredentialRecord } from '../storage/CredentialRecord';

export class CredentialsModule {
  async issueCredential(connection: ConnectionRecord, credentialTemplate: CredentialTemplate) {}

  async getCredentials(): Promise<CredentialRecord[]> {
    return [new CredentialRecord({ offer: '' })];
  }
}

interface CredentialTemplate {
  credDefId: string;
}
