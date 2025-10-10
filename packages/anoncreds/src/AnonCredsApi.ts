import type { SimpleQuery } from '@credo-ts/core'
import type {
  AnonCredsCreateLinkSecretOptions,
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRegisterRevocationRegistryDefinitionOptions,
  AnonCredsRegisterRevocationStatusListOptions,
  AnonCredsUpdateRevocationStatusListOptions,
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
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListReturn,
  RegisterSchemaReturn,
} from './services'
import type { Extensible } from './services/registry/base'

import { AgentContext, inject, injectable } from '@credo-ts/core'

import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsStoreRecordError } from './error'
import {
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRecord,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryDefinitionRecord,
  AnonCredsRevocationRegistryDefinitionRepository,
  AnonCredsRevocationRegistryState,
} from './repository'
import { AnonCredsCredentialDefinitionRecord } from './repository/AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRecord } from './repository/AnonCredsSchemaRecord'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsCredentialDefinitionRecordMetadataKeys } from './repository/anonCredsCredentialDefinitionRecordMetadataTypes'
import { AnonCredsRevocationRegistryDefinitionRecordMetadataKeys } from './repository/anonCredsRevocationRegistryDefinitionRecordMetadataTypes'
import {
  type AnonCredsHolderService,
  AnonCredsHolderServiceSymbol,
  type AnonCredsIssuerService,
  AnonCredsIssuerServiceSymbol,
} from './services'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'
import { dateToTimestamp, storeLinkSecret } from './utils'

@injectable()
export class AnonCredsApi {
  public config: AnonCredsModuleConfig

  private agentContext: AgentContext
  private anonCredsRegistryService: AnonCredsRegistryService
  private anonCredsSchemaRepository: AnonCredsSchemaRepository
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsCredentialDefinitionPrivateRepository: AnonCredsCredentialDefinitionPrivateRepository
  private anonCredsRevocationRegistryDefinitionRepository: AnonCredsRevocationRegistryDefinitionRepository
  private anonCredsRevocationRegistryDefinitionPrivateRepository: AnonCredsRevocationRegistryDefinitionPrivateRepository
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
    anonCredsRevocationRegistryDefinitionRepository: AnonCredsRevocationRegistryDefinitionRepository,
    anonCredsRevocationRegistryDefinitionPrivateRepository: AnonCredsRevocationRegistryDefinitionPrivateRepository,
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
    this.anonCredsRevocationRegistryDefinitionRepository = anonCredsRevocationRegistryDefinitionRepository
    this.anonCredsRevocationRegistryDefinitionPrivateRepository = anonCredsRevocationRegistryDefinitionPrivateRepository
    this.anonCredsCredentialDefinitionRepository = anonCredsCredentialDefinitionRepository
    this.anonCredsCredentialDefinitionPrivateRepository = anonCredsCredentialDefinitionPrivateRepository
    this.anonCredsKeyCorrectnessProofRepository = anonCredsKeyCorrectnessProofRepository
    this.anonCredsLinkSecretRepository = anonCredsLinkSecretRepository
  }

  /**
   * Create a Link Secret, optionally indicating its ID and if it will be the default one
   * If there is no default Link Secret, this will be set as default (even if setAsDefault is false).
   *
   */
  public async createLinkSecret(options?: AnonCredsCreateLinkSecretOptions): Promise<string> {
    const { linkSecretId, linkSecretValue } = await this.anonCredsHolderService.createLinkSecret(this.agentContext, {
      linkSecretId: options?.linkSecretId,
    })

    await storeLinkSecret(this.agentContext, {
      linkSecretId,
      linkSecretValue,
      setAsDefault: options?.setAsDefault,
    })

    return linkSecretId
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

  public async registerCredentialDefinition<T extends Extensible>(
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
            supportRevocation: options.options.supportRevocation,
            schema: schemaResult.schema,
          },
          // NOTE: indy-sdk support has been removed from main repo, but keeping
          // this in place to allow the indy-sdk to still be used as a custom package for some time
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

  public async registerRevocationRegistryDefinition<T extends Extensible = Extensible>(
    options: AnonCredsRegisterRevocationRegistryDefinition<T>
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    const { issuerId, tag, credentialDefinitionId, maximumCredentialNumber } = options.revocationRegistryDefinition

    const tailsFileService = this.agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService

    const tailsDirectoryPath = await tailsFileService.getTailsBasePath(this.agentContext)

    const failedReturnBase = {
      revocationRegistryDefinitionState: {
        state: 'failed' as const,
        reason: `Error registering revocation registry definition for issuerId ${issuerId}`,
      },
      registrationMetadata: {},
      revocationRegistryDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(issuerId)
    if (!registry) {
      failedReturnBase.revocationRegistryDefinitionState.reason = `Unable to register revocation registry definition. No registry found for issuerId ${issuerId}`
      return failedReturnBase
    }

    const { credentialDefinition } = await registry.getCredentialDefinition(this.agentContext, credentialDefinitionId)

    if (!credentialDefinition) {
      failedReturnBase.revocationRegistryDefinitionState.reason = `Unable to register revocation registry definition. No credential definition found for id ${credentialDefinitionId}`
      return failedReturnBase
    }
    try {
      const { revocationRegistryDefinition, revocationRegistryDefinitionPrivate } =
        await this.anonCredsIssuerService.createRevocationRegistryDefinition(this.agentContext, {
          issuerId,
          tag,
          credentialDefinitionId,
          credentialDefinition,
          maximumCredentialNumber,
          tailsDirectoryPath,
        })

      // At this moment, tails file should be published and a valid public URL will be received
      const localTailsLocation = revocationRegistryDefinition.value.tailsLocation

      const { tailsFileUrl } = await tailsFileService.uploadTailsFile(this.agentContext, {
        revocationRegistryDefinition,
      })
      revocationRegistryDefinition.value.tailsLocation = tailsFileUrl

      const result = await registry.registerRevocationRegistryDefinition(this.agentContext, {
        revocationRegistryDefinition,
        options: options.options,
      })

      //  To avoid having unregistered revocation registry definitions in the wallet, the revocation registry definition itself are stored only when the revocation registry definition status is finished, meaning that the revocation registry definition has been successfully registered.
      if (result.revocationRegistryDefinitionState.state === 'finished') {
        await this.storeRevocationRegistryDefinitionRecord(result, revocationRegistryDefinitionPrivate)
      }

      return {
        ...result,
        revocationRegistryDefinitionMetadata: { ...result.revocationRegistryDefinitionMetadata, localTailsLocation },
      }
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.revocationRegistryDefinitionState.reason = `Error storing revocation registry definition records: ${error.message}`
        return failedReturnBase
      }

      failedReturnBase.revocationRegistryDefinitionState.reason = `Error registering revocation registry definition: ${error.message}`
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

  public async registerRevocationStatusList<T extends Extensible = Extensible>(
    options: AnonCredsRegisterRevocationStatusList<T>
  ): Promise<RegisterRevocationStatusListReturn> {
    const { issuerId, revocationRegistryDefinitionId } = options.revocationStatusList

    const failedReturnBase = {
      revocationStatusListState: {
        state: 'failed' as const,
        reason: `Error registering revocation status list for issuerId ${issuerId}`,
      },
      registrationMetadata: {},
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(issuerId)
    if (!registry) {
      failedReturnBase.revocationStatusListState.reason = `Unable to register revocation status list. No registry found for issuerId ${issuerId}`
      return failedReturnBase
    }

    const { revocationRegistryDefinition } = await registry.getRevocationRegistryDefinition(
      this.agentContext,
      revocationRegistryDefinitionId
    )

    if (!revocationRegistryDefinition) {
      failedReturnBase.revocationStatusListState.reason = `Unable to register revocation status list. No revocation registry definition found for ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }
    const tailsFileService = this.agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
    const { tailsFilePath } = await tailsFileService.getTailsFile(this.agentContext, {
      revocationRegistryDefinition,
    })

    try {
      const revocationStatusList = await this.anonCredsIssuerService.createRevocationStatusList(this.agentContext, {
        issuerId,
        revocationRegistryDefinition,
        revocationRegistryDefinitionId,
        tailsFilePath,
      })

      const result = await registry.registerRevocationStatusList(this.agentContext, {
        revocationStatusList,
        options: options.options,
      })

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.revocationStatusListState.reason = `Error storing revocation status list records: ${error.message}`
        return failedReturnBase
      }

      failedReturnBase.revocationStatusListState.reason = `Error registering revocation status list: ${error.message}`
      return failedReturnBase
    }
  }

  public async updateRevocationStatusList<T extends Extensible = Extensible>(
    options: AnonCredsUpdateRevocationStatusList<T>
  ): Promise<RegisterRevocationStatusListReturn> {
    const { issuedCredentialIndexes, revokedCredentialIndexes, revocationRegistryDefinitionId } =
      options.revocationStatusList

    const failedReturnBase = {
      revocationStatusListState: {
        state: 'failed' as const,
        reason: `Error updating revocation status list for revocation registry definition id ${options.revocationStatusList.revocationRegistryDefinitionId}`,
      },
      registrationMetadata: {},
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.revocationStatusList.revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.revocationStatusListState.reason = `Unable to update revocation status list. No registry found for id ${options.revocationStatusList.revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    const { revocationRegistryDefinition } = await registry.getRevocationRegistryDefinition(
      this.agentContext,
      revocationRegistryDefinitionId
    )

    if (!revocationRegistryDefinition) {
      failedReturnBase.revocationStatusListState.reason = `Unable to update revocation status list. No revocation registry definition found for ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    const { revocationStatusList: previousRevocationStatusList } = await this.getRevocationStatusList(
      revocationRegistryDefinitionId,
      dateToTimestamp(new Date())
    )

    if (!previousRevocationStatusList) {
      failedReturnBase.revocationStatusListState.reason = `Unable to update revocation status list. No previous revocation status list found for ${options.revocationStatusList.revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    const tailsFileService = this.agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
    const { tailsFilePath } = await tailsFileService.getTailsFile(this.agentContext, {
      revocationRegistryDefinition,
    })

    try {
      const revocationStatusList = await this.anonCredsIssuerService.updateRevocationStatusList(this.agentContext, {
        issued: issuedCredentialIndexes,
        revoked: revokedCredentialIndexes,
        revocationStatusList: previousRevocationStatusList,
        revocationRegistryDefinition,
        tailsFilePath,
      })

      const result = await registry.registerRevocationStatusList(this.agentContext, {
        revocationStatusList,
        options: options.options,
      })

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.revocationStatusListState.reason = `Error storing revocation status list records: ${error.message}`
        return failedReturnBase
      }

      failedReturnBase.revocationStatusListState.reason = `Error registering revocation status list: ${error.message}`
      return failedReturnBase
    }
  }

  public async getCredential(id: string) {
    return this.anonCredsHolderService.getCredential(this.agentContext, { id })
  }

  public async getCredentials(options: GetCredentialsOptions) {
    return this.anonCredsHolderService.getCredentials(this.agentContext, options)
  }

  private async storeRevocationRegistryDefinitionRecord(
    result: RegisterRevocationRegistryDefinitionReturn,
    revocationRegistryDefinitionPrivate?: Record<string, unknown>
  ): Promise<void> {
    try {
      // If we have both the revocationRegistryDefinition and the revocationRegistryDefinitionId we will store a copy
      // of the credential definition. We may need to handle an edge case in the future where we e.g. don't have the
      // id yet, and it is registered through a different channel
      if (
        result.revocationRegistryDefinitionState.revocationRegistryDefinition &&
        result.revocationRegistryDefinitionState.revocationRegistryDefinitionId
      ) {
        const revocationRegistryDefinitionRecord = new AnonCredsRevocationRegistryDefinitionRecord({
          revocationRegistryDefinitionId: result.revocationRegistryDefinitionState.revocationRegistryDefinitionId,
          revocationRegistryDefinition: result.revocationRegistryDefinitionState.revocationRegistryDefinition,
        })

        // TODO: do we need to store this metadata? For indy, the registration metadata contains e.g.
        // the indyLedgerSeqNo and the didIndyNamespace, but it can get quite big if complete transactions
        // are stored in the metadata
        revocationRegistryDefinitionRecord.metadata.set(
          AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionMetadata,
          result.revocationRegistryDefinitionMetadata
        )
        revocationRegistryDefinitionRecord.metadata.set(
          AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionRegistrationMetadata,
          result.registrationMetadata
        )

        await this.anonCredsRevocationRegistryDefinitionRepository.save(
          this.agentContext,
          revocationRegistryDefinitionRecord
        )

        // Store Revocation Registry Definition private data (if provided by issuer service)
        if (revocationRegistryDefinitionPrivate) {
          const revocationRegistryDefinitionPrivateRecord = new AnonCredsRevocationRegistryDefinitionPrivateRecord({
            revocationRegistryDefinitionId: result.revocationRegistryDefinitionState.revocationRegistryDefinitionId,
            credentialDefinitionId: result.revocationRegistryDefinitionState.revocationRegistryDefinition.credDefId,
            value: revocationRegistryDefinitionPrivate,
            state: AnonCredsRevocationRegistryState.Active,
          })
          await this.anonCredsRevocationRegistryDefinitionPrivateRepository.save(
            this.agentContext,
            revocationRegistryDefinitionPrivateRecord
          )
        }
      }
    } catch (error) {
      throw new AnonCredsStoreRecordError('Error storing revocation registry definition records', { cause: error })
    }
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
      throw new AnonCredsStoreRecordError('Error storing credential definition key-correctness-proof and private', {
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
      throw new AnonCredsStoreRecordError('Error storing credential definition records', { cause: error })
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
      throw new AnonCredsStoreRecordError('Error storing schema record', { cause: error })
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

export interface AnonCredsRegisterCredentialDefinitionApiOptions {
  supportRevocation: boolean
}

interface AnonCredsRegisterCredentialDefinition<T extends Extensible = Extensible> {
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
  options: T & AnonCredsRegisterCredentialDefinitionApiOptions
}

interface AnonCredsRegisterSchema<T extends Extensible = Extensible> {
  schema: AnonCredsSchema
  options: T
}

interface AnonCredsRegisterRevocationRegistryDefinition<T extends Extensible = Extensible> {
  revocationRegistryDefinition: AnonCredsRegisterRevocationRegistryDefinitionOptions
  options: T
}

interface AnonCredsRegisterRevocationStatusList<T extends Extensible = Extensible> {
  revocationStatusList: AnonCredsRegisterRevocationStatusListOptions
  options: T
}

interface AnonCredsUpdateRevocationStatusList<T extends Extensible = Extensible> {
  revocationStatusList: AnonCredsUpdateRevocationStatusListOptions
  options: T
}

function isFullCredentialDefinitionInput(
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
): credentialDefinition is AnonCredsCredentialDefinition {
  return 'value' in credentialDefinition
}
