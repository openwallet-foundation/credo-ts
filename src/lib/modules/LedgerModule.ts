import { LedgerService, SchemaTemplate, CredDefTemplate } from '../agent/LedgerService';
import { Wallet } from '../wallet/Wallet';

export class LedgerModule {
  private ledgerService: LedgerService;
  private wallet: Wallet;

  public constructor(wallet: Wallet, ledgerService: LedgerService) {
    this.ledgerService = ledgerService;
    this.wallet = wallet;
  }

  public async connect(poolName: string, poolConfig: PoolConfig) {
    return this.ledgerService.connect(poolName, poolConfig);
  }

  public async registerPublicDid() {
    // TODO: handle ping response message
  }

  public async getPublicDid(did: Did) {
    return this.ledgerService.getPublicDid(did);
  }

  public async registerCredentialSchema(schema: SchemaTemplate) {
    const did = this.wallet.getPublicDid()?.did;
    if (!did) {
      throw new Error('Agent has no public DID.');
    }
    return this.ledgerService.registerSchema(did, schema);
  }

  public async getSchema(id: SchemaId) {
    return this.ledgerService.getCredentialSchema(id);
  }

  public async registerCredentialDefinition(credentialDefinitionTemplate: CredDefTemplate) {
    const did = this.wallet.getPublicDid()?.did;
    if (!did) {
      throw new Error('Agent has no public DID.');
    }
    return this.ledgerService.registerCredentialDefinition(did, credentialDefinitionTemplate);
  }

  public async getCredentialDefinition(id: CredDefId) {
    return this.ledgerService.getCredentialDefinition(id);
  }
}
