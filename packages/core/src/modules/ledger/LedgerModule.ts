import type { DependencyManager } from '../../plugins'
import type { AnonCredsCredentialDefinitionRecord } from '../indy/repository/AnonCredsCredentialDefinitionRecord'
import type { AnonCredsSchemaRecord } from '../indy/repository/AnonCredsSchemaRecord'
import type { SchemaTemplate, CredentialDefinitionTemplate } from './services'
import type { CredDef, NymRole, Schema } from 'indy-sdk'

import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError, RecordNotFoundError } from '../../error'
import { IndySdkError } from '../../error/IndySdkError'
import { injectable, module, inject } from '../../plugins'
import { Wallet } from '../../wallet/Wallet'
import { AnonCredsCredentialDefinitionRepository } from '../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from '../indy/repository/AnonCredsSchemaRepository'

import { IndyPoolService, IndyLedgerService } from './services'

@module()
@injectable()
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

  private async findBySchemaId(schemaId: string): Promise<AnonCredsSchemaRecord | null> {
    try {
      return await this.anonCredsSchemaRepository.getBySchemaId(schemaId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }

  public async getSchema(id: string) {
    return this.ledgerService.getSchema(id)
  }

  public async registerSchema(schema: SchemaTemplate): Promise<Schema> {
    const did = this.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    const schemaId = `${did}:2:${schema.name}:${schema.version}`

    // Try find the schema in the wallet
    const anonSchema = await this.findBySchemaId(schemaId)
    //  Schema in wallet
    if (anonSchema) return anonSchema.schema

    const schemaFromLedger = await this.findBySchemaIdOnLedger(schemaId)
    if (schemaFromLedger) return schemaFromLedger
    return this.ledgerService.registerSchema(did, schema)
  }

  private async findBySchemaIdOnLedger(schemaId: string) {
    try {
      return await this.ledgerService.getSchema(schemaId)
    } catch (e) {
      if (e instanceof IndySdkError) return null

      throw e
    }
  }

  private async findByCredentialDefinitionId(
    credentialDefinitionId: string
  ): Promise<AnonCredsCredentialDefinitionRecord | null> {
    try {
      return await this.anonCredsCredentialDefinitionRepository.getByCredentialDefinitionId(credentialDefinitionId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }

  private async findByCredentialDefinitionIdOnLedger(credentialDefinitionId: string): Promise<CredDef | null> {
    try {
      return await this.ledgerService.getCredentialDefinition(credentialDefinitionId)
    } catch (e) {
      if (e instanceof IndySdkError) return null

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

    // Construct credential definition ID
    const credentialDefinitionId = `${did}:3:CL:${credentialDefinitionTemplate.schema.seqNo}:${credentialDefinitionTemplate.tag}`

    // Check if the credential exists in wallet. If so, return it
    const anonCredDef = await this.findByCredentialDefinitionId(credentialDefinitionTemplate.schema.id)
    if (anonCredDef) {
      return anonCredDef.credentialDefinition
    }

    // Check for the credential on the ledger.
    const credentialDefinitionOnLedger = await this.findByCredentialDefinitionIdOnLedger(credentialDefinitionId)
    if (credentialDefinitionOnLedger)
      throw new AriesFrameworkError(`Credential definition ${credentialDefinitionTemplate.tag} already exists.`)

    // Could not retrieve credential from ledger -> credential is not registered yet. Do nothing
    // Register the credential
    return await this.ledgerService.registerCredentialDefinition(did, {
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

  /**
   * Registers the dependencies of the ledger module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(LedgerModule)

    // Services
    dependencyManager.registerSingleton(IndyLedgerService)
    dependencyManager.registerSingleton(IndyPoolService)
  }
}
