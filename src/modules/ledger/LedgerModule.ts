import type { CredDefId, Did, SchemaId } from 'indy-sdk'
import { inject, scoped, Lifecycle } from 'tsyringe'

import { LedgerService, SchemaTemplate, CredentialDefinitionTemplate, LedgerConnectOptions } from './services'
import { Wallet } from '../../wallet/Wallet'
import { Symbols } from '../../symbols'
import { AriesFrameworkError } from '../../error'

@scoped(Lifecycle.ContainerScoped)
export class LedgerModule {
  private ledgerService: LedgerService
  private wallet: Wallet

  public constructor(@inject(Symbols.Wallet) wallet: Wallet, ledgerService: LedgerService) {
    this.ledgerService = ledgerService
    this.wallet = wallet
  }

  public async connect(poolName: string, poolConfig: LedgerConnectOptions) {
    return this.ledgerService.connect(poolName, poolConfig)
  }

  public async registerPublicDid() {
    throw new AriesFrameworkError('registerPublicDid not implemented.')
  }

  public async getPublicDid(did: Did) {
    return this.ledgerService.getPublicDid(did)
  }

  public async registerSchema(schema: SchemaTemplate) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerSchema(did, schema)
  }

  public async getSchema(id: SchemaId) {
    return this.ledgerService.getSchema(id)
  }

  public async registerCredentialDefinition(credentialDefinitionTemplate: CredentialDefinitionTemplate) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerCredentialDefinition(did, credentialDefinitionTemplate)
  }

  public async getCredentialDefinition(id: CredDefId) {
    return this.ledgerService.getCredentialDefinition(id)
  }
}
