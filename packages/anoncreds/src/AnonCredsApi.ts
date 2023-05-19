import type {
  AnonCredsCreateLinkSecretOptions,
  AnonCredsRegisterCredentialDefinitionOptions,
} from './AnonCredsApiOptions'
import type { AnonCredsCredentialDefinition, AnonCredsSchema } from './models'
import type {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetCredentialsOptions,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaReturn,
} from './services'
import type { Extensible } from './services/registry/base'
import type { SimpleQuery } from '@aries-framework/core'

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
  AnonCredsHolderService,
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerService,
  AnonCredsIssuerServiceSymbol,
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

  public async registerSchema<T extends Extensible = Extensible>(
    options: AnonCredsRegisterSchema<T>
  ): Promise<RegisterSchemaReturn> {
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
      if (result.schemaState.state === 'finished') {
        await this.storeSchemaRecord(registry, result)
      }

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

  public async getCreatedSchemas(query: SimpleQuery<AnonCredsSchemaRecord>) {
    return this.anonCredsSchemaRepository.findByQuery(this.agentContext, query)
  }

  /**
   * Retrieve a {@link GetCredentialDefinitionReturn} from the registry associated
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

  public async registerCredentialDefinition<T extends Extensible = Extensible>(
    options: AnonCredsRegisterCredentialDefinition<T>
  ): Promise<RegisterCredentialDefinitionReturn> {
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

    let credentialDefinition: AnonCredsCredentialDefinition
    let credentialDefinitionPrivate: Record<string, unknown> | undefined = undefined
    let keyCorrectnessProof: Record<string, unknown> | undefined = undefined

    try {
      if (isFullCredentialDefinitionInput(options.credentialDefinition)) {
        credentialDefinition = options.credentialDefinition
      } else {
        // If the input credential definition is not a full credential definition, we need to create one first
        // There's a caveat to when the input contains a full credential, that the credential definition private
        // and key correctness proof must already be stored in the wallet
        const schemaRegistry = this.findRegistryForIdentifier(options.credentialDefinition.schemaId)
        if (!schemaRegistry) {
          failedReturnBase.credentialDefinitionState.reason = `Unable to register credential definition. No registry found for schemaId ${options.credentialDefinition.schemaId}`
          return failedReturnBase
        }

        const schemaResult = await schemaRegistry.getSchema(this.agentContext, options.credentialDefinition.schemaId)

        if (!schemaResult.schema) {
          failedReturnBase.credentialDefinitionState.reason = `error resolving schema with id ${options.credentialDefinition.schemaId}: ${schemaResult.resolutionMetadata.error} ${schemaResult.resolutionMetadata.message}`
          return failedReturnBase
        }

        const createCredentialDefinitionResult = await this.anonCredsIssuerService.createCredentialDefinition(
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

        credentialDefinition = createCredentialDefinitionResult.credentialDefinition
        credentialDefinitionPrivate = createCredentialDefinitionResult.credentialDefinitionPrivate
        keyCorrectnessProof = createCredentialDefinitionResult.keyCorrectnessProof
      }

      const result = await registry.registerCredentialDefinition(this.agentContext, {
        credentialDefinition,
        options: options.options,
      })

      // Once a credential definition is created, the credential definition private and the key correctness proof must be stored because they change even if they the credential is recreated with the same arguments.
      // To avoid having unregistered credential definitions in the wallet, the credential definitions itself are stored only when the credential definition status is finished, meaning that the credential definition has been successfully registered.
      await this.storeCredentialDefinitionPrivateAndKeyCorrectnessRecord(
        result,
        credentialDefinitionPrivate,
        keyCorrectnessProof
      )
      if (result.credentialDefinitionState.state === 'finished') {
        await this.storeCredentialDefinitionRecord(registry, result)
      }

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

  public async getCreatedCredentialDefinitions(query: SimpleQuery<AnonCredsCredentialDefinitionRecord>) {
    return this.anonCredsCredentialDefinitionRepository.findByQuery(this.agentContext, query)
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

  public async getCredential(credentialId: string) {
    return this.anonCredsHolderService.getCredential(this.agentContext, { credentialId })
  }

  public async getCredentials(options: GetCredentialsOptions) {
    return this.anonCredsHolderService.getCredentials(this.agentContext, options)
  }

  private async storeCredentialDefinitionPrivateAndKeyCorrectnessRecord(
    result: RegisterCredentialDefinitionReturn,
    credentialDefinitionPrivate?: Record<string, unknown>,
    keyCorrectnessProof?: Record<string, unknown>
  ): Promise<void> {
    try {
      if (!result.credentialDefinitionState.credentialDefinitionId) return

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
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing credential definition key-correctness-proof and private`, {
        cause: error,
      })
    }
  }

  private async storeCredentialDefinitionRecord(
    registry: AnonCredsRegistry,
    result: RegisterCredentialDefinitionReturn
  ): Promise<void> {
    try {
      // If we have both the credentialDefinition and the credentialDefinitionId we will store a copy of the credential definition. We may need to handle an
      // edge case in the future where we e.g. don't have the id yet, and it is registered through a different channel
      if (
        !result.credentialDefinitionState.credentialDefinition ||
        !result.credentialDefinitionState.credentialDefinitionId
      ) {
        return
      }
      const credentialDefinitionRecord = new AnonCredsCredentialDefinitionRecord({
        credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
        credentialDefinition: result.credentialDefinitionState.credentialDefinition,
        methodName: registry.methodName,
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
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing credential definition records`, { cause: error })
    }
  }

  private async storeSchemaRecord(registry: AnonCredsRegistry, result: RegisterSchemaReturn): Promise<void> {
    try {
      // If we have both the schema and the schemaId we will store a copy of the schema. We may need to handle an
      // edge case in the future where we e.g. don't have the id yet, and it is registered through a different channel
      if (result.schemaState.schema && result.schemaState.schemaId) {
        const schemaRecord = new AnonCredsSchemaRecord({
          schemaId: result.schemaState.schemaId,
          schema: result.schemaState.schema,
          methodName: registry.methodName,
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

interface AnonCredsRegisterCredentialDefinition<T extends Extensible = Extensible> {
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
  options: T
}

interface AnonCredsRegisterSchema<T extends Extensible = Extensible> {
  schema: AnonCredsSchema
  options: T
}

function isFullCredentialDefinitionInput(
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
): credentialDefinition is AnonCredsCredentialDefinition {
  return 'value' in credentialDefinition
}
