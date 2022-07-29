import type { PoolConfig, SchemaTemplate, CredentialDefinitionTemplate } from './services/LedgerService'
import type { CredDef, NymRole, Schema } from 'indy-sdk'

import { AgentContext } from '../../agent'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { IndySdkError } from '../../error/IndySdkError'
import { inject, injectable } from '../../plugins'
import { isIndyError } from '../../utils/indyError'
import { AnonCredsCredentialDefinitionRepository } from '../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from '../indy/repository/AnonCredsSchemaRepository'

import { LedgerModuleConfig } from './LedgerModuleConfig'
import { generateCredentialDefinitionId, generateSchemaId } from './ledgerUtil'
import { LedgerService } from './services/LedgerService'

@injectable()
export class LedgerApi {
  public config: LedgerModuleConfig

  private ledgerService: LedgerService
  private agentContext: AgentContext
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsSchemaRepository: AnonCredsSchemaRepository

  public constructor(
    @inject(InjectionSymbols.LedgerService) ledgerService: LedgerService,
    agentContext: AgentContext,
    anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository,
    anonCredsSchemaRepository: AnonCredsSchemaRepository,
    config: LedgerModuleConfig
  ) {
    this.ledgerService = ledgerService
    this.agentContext = agentContext
    this.anonCredsCredentialDefinitionRepository = anonCredsCredentialDefinitionRepository
    this.anonCredsSchemaRepository = anonCredsSchemaRepository
    this.config = config
  }

  public setPools(poolConfigs: PoolConfig[]) {
    return this.ledgerService.setPools(poolConfigs)
  }

  /**
   * Connect to all the ledger pools
   */
  public async connectToPools() {
    await this.ledgerService.connectToPools()
  }

  public async registerPublicDid(did: string, verkey: string, alias: string, role?: NymRole) {
    const myPublicDid = this.agentContext.wallet.publicDid?.did

    if (!myPublicDid) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerPublicDid(this.agentContext, myPublicDid, did, verkey, alias, role)
  }

  public async getPublicDid(did: string) {
    return this.ledgerService.getPublicDid(this.agentContext, did)
  }

  public async getSchema(id: string) {
    return this.ledgerService.getSchema(this.agentContext, id)
  }

  public async registerSchema(schema: SchemaTemplate): Promise<Schema> {
    const did = this.agentContext.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    const schemaId = generateSchemaId(did, schema.name, schema.version)

    // Try find the schema in the wallet
    const schemaRecord = await this.anonCredsSchemaRepository.findBySchemaId(this.agentContext, schemaId)
    //  Schema in wallet
    if (schemaRecord) return schemaRecord.schema

    const schemaFromLedger = await this.findBySchemaIdOnLedger(schemaId)
    if (schemaFromLedger) return schemaFromLedger
    return this.ledgerService.registerSchema(this.agentContext, did, schema)
  }

  private async findBySchemaIdOnLedger(schemaId: string) {
    try {
      return await this.ledgerService.getSchema(this.agentContext, schemaId)
    } catch (e) {
      if (e instanceof IndySdkError && isIndyError(e.cause, 'LedgerNotFound')) return null

      throw e
    }
  }

  private async findByCredentialDefinitionIdOnLedger(credentialDefinitionId: string): Promise<CredDef | null> {
    try {
      return await this.ledgerService.getCredentialDefinition(this.agentContext, credentialDefinitionId)
    } catch (e) {
      if (e instanceof IndySdkError && isIndyError(e.cause, 'LedgerNotFound')) return null

      throw e
    }
  }

  public async registerCredentialDefinition(
    credentialDefinitionTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'>
  ) {
    const did = this.agentContext.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    // Construct credential definition ID
    const credentialDefinitionId = generateCredentialDefinitionId(
      did,
      credentialDefinitionTemplate.schema.seqNo,
      credentialDefinitionTemplate.tag
    )

    // Check if the credential exists in wallet. If so, return it
    const credentialDefinitionRecord = await this.anonCredsCredentialDefinitionRepository.findByCredentialDefinitionId(
      this.agentContext,
      credentialDefinitionId
    )
    if (credentialDefinitionRecord) return credentialDefinitionRecord.credentialDefinition

    // Check for the credential on the ledger.
    const credentialDefinitionOnLedger = await this.findByCredentialDefinitionIdOnLedger(credentialDefinitionId)
    if (credentialDefinitionOnLedger) {
      throw new AriesFrameworkError(
        `No credential definition record found and credential definition ${credentialDefinitionId} already exists on the ledger.`
      )
    }

    // Register the credential
    return await this.ledgerService.registerCredentialDefinition(this.agentContext, did, {
      ...credentialDefinitionTemplate,
      signatureType: 'CL',
    })
  }

  public async getCredentialDefinition(id: string) {
    return this.ledgerService.getCredentialDefinition(this.agentContext, id)
  }

  public async getRevocationRegistryDefinition(revocationRegistryDefinitionId: string) {
    return this.ledgerService.getRevocationRegistryDefinition(this.agentContext, revocationRegistryDefinitionId)
  }

  public async getRevocationRegistryDelta(
    revocationRegistryDefinitionId: string,
    fromSeconds = 0,
    toSeconds = new Date().getTime()
  ) {
    return this.ledgerService.getRevocationRegistryDelta(
      this.agentContext,
      revocationRegistryDefinitionId,
      fromSeconds,
      toSeconds
    )
  }
}
