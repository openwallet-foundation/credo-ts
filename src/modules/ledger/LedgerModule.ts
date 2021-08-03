import type { SchemaTemplate, CredentialDefinitionTemplate } from './services'
import type { CredDefId, Did, SchemaId, RevRegId } from 'indy-sdk'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Wallet } from '../../wallet/Wallet'

import { LedgerService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class LedgerModule {
  private ledgerService: LedgerService
  private wallet: Wallet

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, ledgerService: LedgerService) {
    this.ledgerService = ledgerService
    this.wallet = wallet
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

  public async getRevocRegDef(revocRegDefId: RevRegId) {
    return this.ledgerService.getRevocRegDef(revocRegDefId)
  }

  public async getRevocRegDelta(revRegId: RevRegId, from = 0, to = new Date().getTime()) {
    return this.ledgerService.getRevocRegDelta(revRegId, from, to)
  }
}
