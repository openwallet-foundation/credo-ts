import { LedgerService, SchemaTemplate, CredDefTemplate } from '../agent/LedgerService';
import { Wallet } from '../wallet/Wallet';

export class LedgerModule {
  ledgerService: LedgerService;
  wallet: Wallet;

  constructor(wallet: Wallet, ledgerService: LedgerService) {
    this.ledgerService = ledgerService;
    this.wallet = wallet;
  }

  async connect(poolName: string, poolConfig: PoolConfig) {
    return this.ledgerService.connect(poolName, poolConfig);
  }

  async registerPublicDid() {
    // TODO: handle ping response message
  }

  async getPublicDid(did: Did) {
    return this.ledgerService.getPublicDid(did);
  }

  async registerCredentialSchema(schema: SchemaTemplate) {
    const did = this.wallet.getPublicDid()?.did;
    if (!did) {
      throw new Error('Agent has no public DID.');
    }
    return this.ledgerService.registerSchema(did, schema);
  }

  async getSchema(id: SchemaId) {
    return this.ledgerService.getCredentialSchema(id);
  }

  async registerCredentialDefinition(credentialDefinitionTemplate: CredDefTemplate) {
    const did = this.wallet.getPublicDid()?.did;
    if (!did) {
      throw new Error('Agent has no public DID.');
    }
    return this.ledgerService.registerCredentialDefinition(did, credentialDefinitionTemplate);
  }

  async getCredentialDefinition(id: CredDefId) {
    return this.ledgerService.getCredentialDefinition(id);
  }
}
