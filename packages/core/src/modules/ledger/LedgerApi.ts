import type { IndyPoolConfig } from './IndyPool'
import type { SchemaTemplate, CredentialDefinitionTemplate } from './services'
import type { CredDef, NymRole, Schema } from 'indy-sdk'

import { AgentContext } from '../../agent'
import { AriesFrameworkError } from '../../error'
import { IndySdkError } from '../../error/IndySdkError'
import { injectable } from '../../plugins'
import { isIndyError } from '../../utils/indyError'
import {
  getQualifiedIdentifierCredDef,
  getQualifiedIdentifierSchema,
  getLegacyIndyCredentialDefinitionId,
  getLegacyIndySchemaId,
} from '../../utils/indyIdentifiers'
import { AnonCredsCredentialDefinitionRecord } from '../indy/repository/AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialDefinitionRepository } from '../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRecord } from '../indy/repository/AnonCredsSchemaRecord'
import { AnonCredsSchemaRepository } from '../indy/repository/AnonCredsSchemaRepository'

import { LedgerModuleConfig } from './LedgerModuleConfig'
import { generateCredentialDefinitionId, generateSchemaId } from './ledgerUtil'
import { IndyLedgerService } from './services'

@injectable()
export class LedgerApi {
  public config: LedgerModuleConfig

  private ledgerService: IndyLedgerService
  private agentContext: AgentContext
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsSchemaRepository: AnonCredsSchemaRepository

  public constructor(
    ledgerService: IndyLedgerService,
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

  public setPools(poolConfigs: IndyPoolConfig[]) {
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

    // Generate the qualified ID
    const qualifiedIdentifier = getQualifiedIdentifierSchema(this.ledgerService.getDidIndyNamespace(), schema, schemaId)

    // Try find the schema in the wallet
    const schemaRecord = await this.anonCredsSchemaRepository.findById(this.agentContext, qualifiedIdentifier)
    // Schema in wallet
    if (schemaRecord) {
      // Transform qualified to unqualified
      schemaRecord.schema.id = getLegacyIndySchemaId(schemaRecord.schema.id)
      return {
        ...schemaRecord?.schema,
        id: getLegacyIndySchemaId(schemaRecord.id),
      }
    }

    const schemaFromLedger = await this.findBySchemaIdOnLedger(schemaId)

    if (schemaFromLedger) return schemaFromLedger
    const createdSchema = await this.ledgerService.registerSchema(this.agentContext, did, schema)

    const anonCredsSchema = new AnonCredsSchemaRecord({
      schema: { ...createdSchema, id: qualifiedIdentifier },
    })
    await this.anonCredsSchemaRepository.save(this.agentContext, anonCredsSchema)
    return createdSchema
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

    // Construct qualified identifier
    const qualifiedIdentifier = getQualifiedIdentifierCredDef(
      this.ledgerService.getDidIndyNamespace(),
      credentialDefinitionId,
      credentialDefinitionTemplate
    )

    // Check if the credential exists in wallet. If so, return it
    const credentialDefinitionRecord = await this.anonCredsCredentialDefinitionRepository.findById(
      this.agentContext,
      qualifiedIdentifier
    )

    // Credential Definition in wallet
    if (credentialDefinitionRecord) {
      // Transform qualified to unqualified
      credentialDefinitionRecord.credentialDefinition.id = getLegacyIndyCredentialDefinitionId(
        credentialDefinitionRecord.credentialDefinition.id
      )
      return credentialDefinitionRecord.credentialDefinition
    }

    // Check for the credential on the ledger.
    const credentialDefinitionOnLedger = await this.findByCredentialDefinitionIdOnLedger(credentialDefinitionId)
    if (credentialDefinitionOnLedger) {
      throw new AriesFrameworkError(
        `No credential definition record found and credential definition ${credentialDefinitionId} already exists on the ledger.`
      )
    }

    // Register the credential
    const registeredDefinition = await this.ledgerService.registerCredentialDefinition(this.agentContext, did, {
      ...credentialDefinitionTemplate,
      signatureType: 'CL',
    })
    // Replace the unqualified with qualified Identifier in anonCred
    const anonCredCredential = new AnonCredsCredentialDefinitionRecord({
      credentialDefinition: { ...registeredDefinition, id: qualifiedIdentifier },
    })
    await this.anonCredsCredentialDefinitionRepository.save(this.agentContext, anonCredCredential)

    return registeredDefinition
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
