import type { CredDefId, Did, PoolConfig, SchemaId } from 'indy-sdk'
import { LedgerService, SchemaTemplate, CredDefTemplate } from './services'
import { Wallet } from '../../wallet/Wallet'

export class LedgerModule {
  private ledgerService: LedgerService
  private wallet: Wallet

  public constructor(wallet: Wallet, ledgerService: LedgerService) {
    this.ledgerService = ledgerService
    this.wallet = wallet
  }

  public async connect(poolName: string, poolConfig: PoolConfig) {
    return this.ledgerService.connect(poolName, poolConfig)
  }

  public async registerPublicDid() {
    throw new Error('registerPublicDid not implemented.')
  }

  public async getPublicDid(did: Did) {
    return this.ledgerService.getPublicDid(did)
  }

  public async registerSchema(schema: SchemaTemplate) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new Error('Agent has no public DID.')
    }

    return this.ledgerService.registerSchema(did, schema)
  }

  public async getSchema(id: SchemaId) {
    return this.ledgerService.getSchema(id)
  }

  public async registerCredentialDefinition(credentialDefinitionTemplate: CredDefTemplate) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new Error('Agent has no public DID.')
    }

    return this.ledgerService.registerCredentialDefinition(did, credentialDefinitionTemplate)
  }

  public async getCredentialDefinition(id: CredDefId) {
    return this.ledgerService.getCredentialDefinition(id)
  }
}
