import type {
  AnonCredsCreateLinkSecretOptions,
  AnonCredsRegisterCredentialDefinitionOptions,
} from './AnonCredsApiOptions'
import type {
  GetCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from './services'
import type { Extensible } from './services/registry/base'

import { AgentContext, inject, injectable } from '@aries-framework/core'

import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsStoreRecordError } from './error'
import {
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRecord,
  AnonCredsLinkSecretRepository,
} from './repository'
import { AnonCredsCredentialDefinitionRecord } from './repository/AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRecord } from './repository/AnonCredsSchemaRecord'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsCredentialDefinitionRecordMetadataKeys } from './repository/anonCredsCredentialDefinitionRecordMetadataTypes'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsIssuerService,
  AnonCredsHolderService,
} from './services'
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
  private anonCredsLinkSecretRepository: AnonCredsLinkSecretRepository
  private anonCredsIssuerService: AnonCredsIssuerService
  private anonCredsHolderService: AnonCredsHolderService

  public constructor(
    agentContext: AgentContext,
    anonCredsRegistryService: AnonCredsRegistryService,
    config: AnonCredsModuleConfig,
    @inject(AnonCredsIssuerServiceSymbol) anonCredsIssuerService: AnonCredsIssuerService,
    @inject(AnonCredsHolderServiceSymbol) anonCredsHolderService: AnonCredsHolderService,
    anonCredsSchemaRepository: AnonCredsSchemaRepository,
    anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository,
    anonCredsCredentialDefinitionPrivateRepository: AnonCredsCredentialDefinitionPrivateRepository,
    anonCredsKeyCorrectnessProofRepository: AnonCredsKeyCorrectnessProofRepository,
    anonCredsLinkSecretRepository: AnonCredsLinkSecretRepository
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
    this.anonCredsLinkSecretRepository = anonCredsLinkSecretRepository
  }

  /**
   * Create a Link Secret, optionally indicating its ID and if it will be the default one
   * If there is no default Link Secret, this will be set as default (even if setAsDefault is true).
   *
   */
  public async createLinkSecret(options?: AnonCredsCreateLinkSecretOptions) {
    const { linkSecretId, linkSecretValue } = await this.anonCredsHolderService.createLinkSecret(this.agentContext, {
      linkSecretId: options?.linkSecretId,
    })

    // In some cases we don't have the linkSecretValue. However we still want a record so we know which link secret ids are valid
    const linkSecretRecord = new AnonCredsLinkSecretRecord({ linkSecretId, value: linkSecretValue })

    // If it is the first link secret registered, set as default
    const defaultLinkSecretRecord = await this.anonCredsLinkSecretRepository.findDefault(this.agentContext)
    if (!defaultLinkSecretRecord || options?.setAsDefault) {
      linkSecretRecord.setTag('isDefault', true)
    }

    // Set the current default link secret as not default
    if (defaultLinkSecretRecord && options?.setAsDefault) {
      defaultLinkSecretRecord.setTag('isDefault', false)
      await this.anonCredsLinkSecretRepository.update(this.agentContext, defaultLinkSecretRecord)
    }

    await this.anonCredsLinkSecretRepository.save(this.agentContext, linkSecretRecord)
  }

  /**
   * Get a list of ids for the created link secrets
   */
  public async getLinkSecretIds(): Promise<string[]> {
    const linkSecrets = await this.anonCredsLinkSecretRepository.getAll(this.agentContext)

    return linkSecrets.map((linkSecret) => linkSecret.linkSecretId)
  }

  /**
   * Retrieve a {@link AnonCredsSchema} from the registry associated
   * with the {@link schemaId}
   */
  public async getSchema(schemaId: string): Promise<GetSchemaReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve schema ${schemaId}`,
      },
      schemaId,
      schemaMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(schemaId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve schema ${schemaId}: No registry found for identifier ${schemaId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getSchema(this.agentContext, schemaId)
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve schema ${schemaId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async registerSchema(options: RegisterSchemaOptions): Promise<RegisterSchemaReturn> {
    const failedReturnBase = {
      schemaState: {
        state: 'failed' as const,
        schema: options.schema,
        reason: `Error registering schema for issuerId ${options.schema.issuerId}`,
      },
      registrationMetadata: {},
      schemaMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.schema.issuerId)
    if (!registry) {
      failedReturnBase.schemaState.reason = `Unable to register schema. No registry found for issuerId ${options.schema.issuerId}`
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
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve credential definition ${credentialDefinitionId}`,
      },
      credentialDefinitionId,
      credentialDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(credentialDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve credential definition ${credentialDefinitionId}: No registry found for identifier ${credentialDefinitionId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getCredentialDefinition(this.agentContext, credentialDefinitionId)
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve credential definition ${credentialDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async registerCredentialDefinition(options: {
    credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
    // TODO: options should support supportsRevocation at some points
    options: Extensible
  }): Promise<RegisterCredentialDefinitionReturn> {
    const failedReturnBase = {
      credentialDefinitionState: {
        state: 'failed' as const,
        reason: `Error registering credential definition for issuerId ${options.credentialDefinition.issuerId}`,
      },
      registrationMetadata: {},
      credentialDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.credentialDefinition.issuerId)
    if (!registry) {
      failedReturnBase.credentialDefinitionState.reason = `Unable to register credential definition. No registry found for issuerId ${options.credentialDefinition.issuerId}`
      return failedReturnBase
    }

    const schemaRegistry = this.findRegistryForIdentifier(options.credentialDefinition.schemaId)
    if (!schemaRegistry) {
      failedReturnBase.credentialDefinitionState.reason = `Unable to register credential definition. No registry found for schemaId ${options.credentialDefinition.schemaId}`
      return failedReturnBase
    }

    try {
      const schemaResult = await schemaRegistry.getSchema(this.agentContext, options.credentialDefinition.schemaId)

      if (!schemaResult.schema) {
        failedReturnBase.credentialDefinitionState.reason = `error resolving schema with id ${options.credentialDefinition.schemaId}: ${schemaResult.resolutionMetadata.error} ${schemaResult.resolutionMetadata.message}`
        return failedReturnBase
      }

      const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } =
        await this.anonCredsIssuerService.createCredentialDefinition(
          this.agentContext,
          {
            issuerId: options.credentialDefinition.issuerId,
            schemaId: options.credentialDefinition.schemaId,
            tag: options.credentialDefinition.tag,
            supportRevocation: false,
            schema: schemaResult.schema,
          },
          // FIXME: Indy SDK requires the schema seq no to be passed in here. This is not ideal.
          {
            indyLedgerSchemaSeqNo: schemaResult.schemaMetadata.indyLedgerSeqNo,
          }
        )

      const result = await registry.registerCredentialDefinition(this.agentContext, {
        credentialDefinition,
        options: options.options,
      })

      await this.storeCredentialDefinitionRecord(result, credentialDefinitionPrivate, keyCorrectnessProof)

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.credentialDefinitionState.reason = `Error storing credential definition records: ${error.message}`
        return failedReturnBase
      }

      // In theory registerCredentialDefinition SHOULD NOT throw, but we can't know for sure
      failedReturnBase.credentialDefinitionState.reason = `Error registering credential definition: ${error.message}`
      return failedReturnBase
    }
  }

  /**
   * Retrieve a {@link AnonCredsRevocationRegistryDefinition} from the registry associated
   * with the {@link revocationRegistryDefinitionId}
   */
  public async getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve revocation registry ${revocationRegistryDefinitionId}`,
      },
      revocationRegistryDefinitionId,
      revocationRegistryDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation registry ${revocationRegistryDefinitionId}: No registry found for identifier ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getRevocationRegistryDefinition(this.agentContext, revocationRegistryDefinitionId)
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation registry ${revocationRegistryDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  /**
   * Retrieve the {@link AnonCredsRevocationStatusList} for the given {@link timestamp} from the registry associated
   * with the {@link revocationRegistryDefinitionId}
   */
  public async getRevocationStatusList(
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}`,
      },
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}: No registry found for identifier ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getRevocationStatusList(
        this.agentContext,
        revocationRegistryDefinitionId,
        timestamp
      )
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  private async storeCredentialDefinitionRecord(
    result: RegisterCredentialDefinitionReturn,
    credentialDefinitionPrivate?: Record<string, unknown>,
    keyCorrectnessProof?: Record<string, unknown>
  ): Promise<void> {
    try {
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
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing credential definition records`, { cause: error })
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
