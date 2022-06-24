import type { AnonCredsCredentialDefinitionRecord } from '../indy/repository/AnonCredsCredentialDefinitionRecord'
import type { AnonCredsSchemaRecord } from '../indy/repository/AnonCredsSchemaRecord'
import type { SchemaTemplate, CredentialDefinitionTemplate } from './services'
import type { NymRole } from 'indy-sdk'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError, RecordNotFoundError } from '../../error'
import { Wallet } from '../../wallet/Wallet'
import { AnonCredsCredentialDefinitionRepository } from '../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from '../indy/repository/AnonCredsSchemaRepository'

import { IndyLedgerService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class LedgerModule {
  private ledgerService: IndyLedgerService
  private wallet: Wallet
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsSchemaRepository: AnonCredsSchemaRepository

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    ledgerService: IndyLedgerService,
    anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository,
    anonCredsSchemaRepository: AnonCredsSchemaRepository
  ) {
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.anonCredsCredentialDefinitionRepository = anonCredsCredentialDefinitionRepository
    this.anonCredsSchemaRepository = anonCredsSchemaRepository
  }

  /**
   * Connect to all the ledger pools
   */
  public async connectToPools() {
    await this.ledgerService.connectToPools()
  }

  public async registerPublicDid(did: string, verkey: string, alias: string, role?: NymRole) {
    const myPublicDid = this.wallet.publicDid?.did

    if (!myPublicDid) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerPublicDid(myPublicDid, did, verkey, alias, role)
  }

  public async getPublicDid(did: string) {
    return this.ledgerService.getPublicDid(did)
  }

  public async findBySchemaId(schemaId: string): Promise<AnonCredsSchemaRecord | null> {
    try {
      return await this.anonCredsSchemaRepository.getBySchemaId(schemaId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }
  public async registerSchema(schema: SchemaTemplate) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    const schemaId = `${did}:2:${schema.name}:${schema.version}`

    const anonSchema = await this.findBySchemaId(schemaId)
    if (anonSchema) {
      return await this.getSchema(anonSchema.getTags().schemaId)
    }

    return this.ledgerService.registerSchema(did, schema)
  }

  public async getSchema(id: string) {
    return this.ledgerService.getSchema(id)
  }

  public async findByCredentialDefinitionId(
    credentialDefinitionId: string
  ): Promise<AnonCredsCredentialDefinitionRecord | null> {
    try {
      return await this.anonCredsCredentialDefinitionRepository.getByCredentialDefinitionId(credentialDefinitionId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }

  public async registerCredentialDefinition(
    credentialDefinitionTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'>
  ) {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    const credentialDefinitionId = `${did}:3:CL:${credentialDefinitionTemplate.schema.seqNo}:${credentialDefinitionTemplate.tag}`
    const anonCredDef = await this.findByCredentialDefinitionId(credentialDefinitionTemplate.schema.id)
    if (anonCredDef) {
      return await this.getCredentialDefinition(credentialDefinitionId)
    }

    return this.ledgerService.registerCredentialDefinition(did, {
      ...credentialDefinitionTemplate,
      signatureType: 'CL',
    })
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
