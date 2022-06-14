import type { TransactionAuthorAgreement } from './IndyPool'
import type { SchemaTemplate, CredentialDefinitionTemplate } from './services'
import type { NymRole } from 'indy-sdk'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Wallet } from '../../wallet/Wallet'

import { IndyLedgerService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class LedgerModule {
  private ledgerService: IndyLedgerService
  private wallet: Wallet

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, ledgerService: IndyLedgerService) {
    this.ledgerService = ledgerService
    this.wallet = wallet
  }

  /**
   * Connect to all the ledger pools
   */
  public async connectToPools() {
    await this.ledgerService.connectToPools()
  }

  public async registerPublicDid(
    did: string,
    verkey: string,
    alias: string,
    role?: NymRole,
    taa?: TransactionAuthorAgreement
  ) {
    const myPublicDid = this.wallet.publicDid?.did

    if (!myPublicDid) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerPublicDid(myPublicDid, did, verkey, alias, role, taa)
  }

  public async getPublicDid(did: string) {
    return this.ledgerService.getPublicDid(did)
  }

  public async registerSchema(schema: SchemaTemplate, taa?: TransactionAuthorAgreement) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerSchema(did, schema, taa)
  }

  public async getSchema(id: string) {
    return this.ledgerService.getSchema(id)
  }

  public async registerCredentialDefinition(
    credentialDefinitionTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'>,
    taa?: TransactionAuthorAgreement
  ) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerCredentialDefinition(
      did,
      {
        ...credentialDefinitionTemplate,
        signatureType: 'CL',
      },
      taa
    )
  }

  public async getCredentialDefinition(id: string) {
    return this.ledgerService.getCredentialDefinition(id)
  }

  public async getRevocationRegistryDefinition(revocationRegistryDefinitionId: string) {
    return this.ledgerService.getRevocationRegistryDefinition(revocationRegistryDefinitionId)
  }

  public async getRevocationRegistryDelta(
    revocationRegistryDefinitionId: string,
    fromSeconds = 0,
    toSeconds = new Date().getTime()
  ) {
    return this.ledgerService.getRevocationRegistryDelta(revocationRegistryDefinitionId, fromSeconds, toSeconds)
  }
}
