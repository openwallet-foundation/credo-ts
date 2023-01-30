import type { AnonCredsCreateMasterSecretOptions } from './AnonCredsApiOptions'
import type { AnonCredsCredentialDefinition } from './models'
import type {
  GetCredentialDefinitionReturn,
  GetRevocationListReturn,
  GetRevocationRegistryDefinitionReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from './services'
import type { Extensible } from './services/registry/base'

import { AgentContext, injectable } from '@aries-framework/core'

import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsStoreRecordError } from './error'
import {
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsMasterSecretRecord,
  AnonCredsMasterSecretRepository,
} from './repository'
import { AnonCredsCredentialDefinitionRecord } from './repository/AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRecord } from './repository/AnonCredsSchemaRecord'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsCredentialDefinitionRecordMetadataKeys } from './repository/anonCredsCredentialDefinitionRecordMetadataTypes'
import { AnonCredsIssuerService, AnonCredsHolderService } from './services'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'

@injectable()
export class AnonCredsApi {
  public config: AnonCredsModuleConfig

  private agentContext: AgentContext
  private anonCredsRegistryService: AnonCredsRegistryService
  private anonCredsSchemaRepository: AnonCredsSchemaRepository
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsCredentialDefinitionPrivateRepository: AnonCredsCredentialDefinitionPrivateRepository
  private anonCredsKeyCorrectnessProofRepository: AnonCredsKeyCorrectnessProofRepository
  private anonCredsMasterSecretRepository: AnonCredsMasterSecretRepository

  // TODO: how do we inject the anoncreds services?
  private anonCredsIssuerService: AnonCredsIssuerService
  private anonCredsHolderService: AnonCredsHolderService

  public constructor(
    agentContext: AgentContext,
    anonCredsRegistryService: AnonCredsRegistryService,
    config: AnonCredsModuleConfig,
    anonCredsIssuerService: AnonCredsIssuerService,
    anonCredsHolderService: AnonCredsHolderService,
    anonCredsSchemaRepository: AnonCredsSchemaRepository,
    anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository,
    anonCredsCredentialDefinitionPrivateRepository: AnonCredsCredentialDefinitionPrivateRepository,
    anonCredsKeyCorrectnessProofRepository: AnonCredsKeyCorrectnessProofRepository,
    anonCredsMasterSecretRepository: AnonCredsMasterSecretRepository
  ) {
    this.agentContext = agentContext
    this.anonCredsRegistryService = anonCredsRegistryService
    this.config = config
    this.anonCredsIssuerService = anonCredsIssuerService
    this.anonCredsHolderService = anonCredsHolderService
    this.anonCredsSchemaRepository = anonCredsSchemaRepository
    this.anonCredsCredentialDefinitionRepository = anonCredsCredentialDefinitionRepository
    this.anonCredsCredentialDefinitionPrivateRepository = anonCredsCredentialDefinitionPrivateRepository
    this.anonCredsKeyCorrectnessProofRepository = anonCredsKeyCorrectnessProofRepository
    this.anonCredsMasterSecretRepository = anonCredsMasterSecretRepository
  }

  /**
   * Create a Master Secret, optionally indicating its ID and if it will be the default one
   * If there is no other Master Secret, this will be the default one.
   *
   */
  public async createMasterSecret(options?: AnonCredsCreateMasterSecretOptions) {
    const { masterSecretId, masterSecretValue } = await this.anonCredsHolderService.createMasterSecret(
      this.agentContext,
      {
        masterSecretId: options?.masterSecretId,
      }
    )

    // TODO: If no value is stored (indy-sdk case), should it still be saved in order to retrieve wallet's default master secret id?
    if (masterSecretValue) {
      const masterSecretRecord = new AnonCredsMasterSecretRecord({ masterSecretId, value: masterSecretValue })

      // If it is the first master secret registered, set as default
      const allRecords = await this.anonCredsMasterSecretRepository.getAll(this.agentContext)
      if (allRecords.length === 0 || options?.setAsDefault) {
        masterSecretRecord.setTag('default', true)
      }

      // Update any other record if this one is set as default
      if (options?.setAsDefault) {
        for (const record of allRecords) {
          record.setTag('default', false)
          await this.anonCredsMasterSecretRepository.update(this.agentContext, record)
        }
      }

      await this.anonCredsMasterSecretRepository.save(this.agentContext, masterSecretRecord)
    }
  }

  /**
   * Retrieve a {@link AnonCredsSchema} from the registry associated
   * with the {@link schemaId}
   */
  public async getSchema(schemaId: string): Promise<GetSchemaReturn> {
    const registry = this.anonCredsRegistryService.getRegistryForIdentifier(this.agentContext, schemaId)

    try {
      const result = await registry.getSchema(this.agentContext, schemaId)
      return result
    } catch (error) {
      return {
        resolutionMetadata: {
          error: 'error',
          message: `Unable to resolve schema ${schemaId}: ${error.message}`,
        },
        schema: null,
        schemaId,
        schemaMetadata: {},
      }
    }
  }

  public async registerSchema(options: RegisterSchemaOptions): Promise<RegisterSchemaReturn> {
    const failedReturnBase = {
      schemaState: {
        state: 'failed' as const,
        schema: options.schema,
        schemaId: null,
        reason: `Error registering schema for issuerId ${options.schema.issuerId}`,
      },
      registrationMetadata: {},
      schemaMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.schema.issuerId)

    if (!registry) {
      failedReturnBase.schemaState.reason = `Could not find a registry for issuerId ${options.schema.issuerId}`
      return failedReturnBase
    }

    try {
      const result = await registry.registerSchema(this.agentContext, options)
      await this.storeSchemaRecord(result)

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.schemaState.reason = `Error storing schema record: ${error.message}`
        return failedReturnBase
      }

      // In theory registerSchema SHOULD NOT throw, but we can't know for sure
      failedReturnBase.schemaState.reason = `Error registering schema: ${error.message}`
      return failedReturnBase
    }
  }

  /**
   * Retrieve a {@link AnonCredsCredentialDefinition} from the registry associated
   * with the {@link credentialDefinitionId}
   */
  public async getCredentialDefinition(credentialDefinitionId: string): Promise<GetCredentialDefinitionReturn> {
    const registry = this.anonCredsRegistryService.getRegistryForIdentifier(this.agentContext, credentialDefinitionId)

    const result = await registry.getCredentialDefinition(this.agentContext, credentialDefinitionId)
    return result
  }

  public async registerCredentialDefinition(options: {
    credentialDefinition: Omit<AnonCredsCredentialDefinition, 'value' | 'type'>
    // TODO: options should support supportsRevocation at some points
    options: Extensible
  }): Promise<RegisterCredentialDefinitionReturn> {
    const registry = this.anonCredsRegistryService.getRegistryForIdentifier(
      this.agentContext,
      options.credentialDefinition.issuerId
    )

    const schemaRegistry = this.anonCredsRegistryService.getRegistryForIdentifier(
      this.agentContext,
      options.credentialDefinition.schemaId
    )
    const schemaResult = await schemaRegistry.getSchema(this.agentContext, options.credentialDefinition.schemaId)

    if (!schemaResult.schema) {
      return {
        credentialDefinitionMetadata: {},
        credentialDefinitionState: {
          reason: `error resolving schema with id ${options.credentialDefinition.schemaId}: ${schemaResult.resolutionMetadata.error} ${schemaResult.resolutionMetadata.message}`,
          state: 'failed',
        },
        registrationMetadata: {},
      }
    }

    const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } =
      await this.anonCredsIssuerService.createCredentialDefinition(this.agentContext, {
        issuerId: options.credentialDefinition.issuerId,
        schemaId: options.credentialDefinition.schemaId,
        tag: options.credentialDefinition.tag,
        supportRevocation: false,
        schema: schemaResult.schema,
      })

    const result = await registry.registerCredentialDefinition(this.agentContext, {
      credentialDefinition,
      options: options.options,
    })

    await this.storeCredentialDefinitionRecord(result, credentialDefinitionPrivate, keyCorrectnessProof)

    return result
  }

  /**
   * Retrieve a {@link AnonCredsRevocationRegistryDefinition} from the registry associated
   * with the {@link revocationRegistryDefinitionId}
   */
  public async getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    const registry = this.anonCredsRegistryService.getRegistryForIdentifier(
      this.agentContext,
      revocationRegistryDefinitionId
    )

    const result = await registry.getRevocationRegistryDefinition(this.agentContext, revocationRegistryDefinitionId)
    return result
  }

  /**
   * Retrieve the {@link AnonCredsRevocationList} for the given {@link timestamp} from the registry associated
   * with the {@link revocationRegistryDefinitionId}
   */
  public async getRevocationList(
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<GetRevocationListReturn> {
    const registry = this.anonCredsRegistryService.getRegistryForIdentifier(
      this.agentContext,
      revocationRegistryDefinitionId
    )

    const result = await registry.getRevocationList(this.agentContext, revocationRegistryDefinitionId, timestamp)
    return result
  }

  private async storeCredentialDefinitionRecord(
    result: RegisterCredentialDefinitionReturn,
    credentialDefinitionPrivate?: Record<string, unknown>,
    keyCorrectnessProof?: Record<string, unknown>
  ): Promise<void> {
    // If we have both the credentialDefinition and the credentialDefinitionId we will store a copy of the credential definition. We may need to handle an
    // edge case in the future where we e.g. don't have the id yet, and it is registered through a different channel
    if (
      result.credentialDefinitionState.credentialDefinition &&
      result.credentialDefinitionState.credentialDefinitionId
    ) {
      const credentialDefinitionRecord = new AnonCredsCredentialDefinitionRecord({
        credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
        credentialDefinition: result.credentialDefinitionState.credentialDefinition,
      })

      // TODO: do we need to store this metadata? For indy, the registration metadata contains e.g.
      // the indyLedgerSeqNo and the didIndyNamespace, but it can get quite big if complete transactions
      // are stored in the metadata
      credentialDefinitionRecord.metadata.set(
        AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionMetadata,
        result.credentialDefinitionMetadata
      )
      credentialDefinitionRecord.metadata.set(
        AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionRegistrationMetadata,
        result.registrationMetadata
      )

      await this.anonCredsCredentialDefinitionRepository.save(this.agentContext, credentialDefinitionRecord)

      // Store Credential Definition private data (if provided by issuer service)
      if (credentialDefinitionPrivate) {
        const credentialDefinitionPrivateRecord = new AnonCredsCredentialDefinitionPrivateRecord({
          credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
          value: credentialDefinitionPrivate,
        })
        await this.anonCredsCredentialDefinitionPrivateRepository.save(
          this.agentContext,
          credentialDefinitionPrivateRecord
        )
      }

      if (keyCorrectnessProof) {
        const keyCorrectnessProofRecord = new AnonCredsKeyCorrectnessProofRecord({
          credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
          value: keyCorrectnessProof,
        })
        await this.anonCredsKeyCorrectnessProofRepository.save(this.agentContext, keyCorrectnessProofRecord)
      }
    }
  }

  private async storeSchemaRecord(result: RegisterSchemaReturn): Promise<void> {
    try {
      // If we have both the schema and the schemaId we will store a copy of the schema. We may need to handle an
      // edge case in the future where we e.g. don't have the id yet, and it is registered through a different channel
      if (result.schemaState.schema && result.schemaState.schemaId) {
        const schemaRecord = new AnonCredsSchemaRecord({
          schemaId: result.schemaState.schemaId,
          schema: result.schemaState.schema,
        })

        await this.anonCredsSchemaRepository.save(this.agentContext, schemaRecord)
      }
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing schema record`, { cause: error })
    }
  }

  private findRegistryForIdentifier(identifier: string) {
    try {
      return this.anonCredsRegistryService.getRegistryForIdentifier(this.agentContext, identifier)
    } catch {
      return null
    }
  }
}
