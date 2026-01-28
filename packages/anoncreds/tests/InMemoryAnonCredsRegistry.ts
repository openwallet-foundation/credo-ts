import type { AgentContext } from '@credo-ts/core'
import { Hasher, utils } from '@credo-ts/core'
import {
  getDidIndyCredentialDefinitionId,
  getDidIndyRevocationRegistryDefinitionId,
  getDidIndySchemaId,
} from '../../indy-vdr/src/anoncreds/utils/identifiers'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRegistry,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsSchema,
  GetCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from '../src'
import { bytesToBigint } from '../src/utils/bytesToBigint'
import {
  getUnQualifiedDidIndyDid,
  getUnqualifiedCredentialDefinitionId,
  getUnqualifiedDidIndySchema,
  getUnqualifiedRevocationRegistryDefinitionId,
  getUnqualifiedSchemaId,
  isIndyDid,
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedSchemaId,
  parseIndyCredentialDefinitionId,
  parseIndyDid,
  parseIndyRevocationRegistryId,
  parseIndySchemaId,
} from '../src/utils/indyIdentifiers'
import { dateToTimestamp } from '../src/utils/timestamp'

/**
 * In memory implementation of the {@link AnonCredsRegistry} interface. Useful for testing.
 */
export class InMemoryAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'inMemory'

  public readonly supportedIdentifier = /.+/

  public readonly allowsCaching = true
  public readonly allowsLocalRecord = true

  private schemas: Record<string, AnonCredsSchema>
  private credentialDefinitions: Record<string, AnonCredsCredentialDefinition>
  private revocationRegistryDefinitions: Record<string, AnonCredsRevocationRegistryDefinition>
  private revocationStatusLists: Record<string, Record<string, AnonCredsRevocationStatusList>>

  public constructor({
    existingSchemas = {},
    existingCredentialDefinitions = {},
    existingRevocationRegistryDefinitions = {},
    existingRevocationStatusLists = {},
  }: {
    existingSchemas?: Record<string, AnonCredsSchema>
    existingCredentialDefinitions?: Record<string, AnonCredsCredentialDefinition>
    existingRevocationRegistryDefinitions?: Record<string, AnonCredsRevocationRegistryDefinition>
    existingRevocationStatusLists?: Record<string, Record<string, AnonCredsRevocationStatusList>>
  } = {}) {
    this.schemas = existingSchemas
    this.credentialDefinitions = existingCredentialDefinitions
    this.revocationRegistryDefinitions = existingRevocationRegistryDefinitions
    this.revocationStatusLists = existingRevocationStatusLists
  }

  public async getSchema(_agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    const schema = this.schemas[schemaId]

    if (!schema) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Schema with id ${schemaId} not found in memory registry`,
        },
        schemaId,
        schemaMetadata: {},
      }
    }

    let didIndyNamespace: string | undefined
    if (isUnqualifiedSchemaId(schemaId)) {
      const { namespaceIdentifier, schemaName, schemaVersion } = parseIndySchemaId(schemaId)
      const qualifiedSchemaEnding = `${namespaceIdentifier}/anoncreds/v0/SCHEMA/${schemaName}/${schemaVersion}`
      const qualifiedSchemaId = Object.keys(this.schemas).find((schemaId) => schemaId.endsWith(qualifiedSchemaEnding))
      didIndyNamespace = qualifiedSchemaId ? parseIndySchemaId(qualifiedSchemaId).namespace : undefined
    } else if (isIndyDid(schemaId)) {
      didIndyNamespace = parseIndySchemaId(schemaId).namespace
    }

    return {
      resolutionMetadata: {},
      schema,
      schemaId,
      schemaMetadata: { ...(didIndyNamespace && { didIndyNamespace }) },
    }
  }

  public async registerSchema(
    _agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    const issuerId = options.schema.issuerId

    let schemaId: string
    if (isIndyDid(issuerId)) {
      const { namespace, namespaceIdentifier } = parseIndyDid(issuerId)
      schemaId = getDidIndySchemaId(namespace, namespaceIdentifier, options.schema.name, options.schema.version)
      this.schemas[getUnQualifiedDidIndyDid(schemaId)] = getUnqualifiedDidIndySchema(options.schema)
    } else if (issuerId.startsWith('did:cheqd:')) {
      schemaId = `${issuerId}/resources/${utils.uuid()}`
    } else {
      throw new Error(`Cannot register Schema. Unsupported issuerId '${issuerId}'`)
    }

    this.schemas[schemaId] = options.schema

    return {
      registrationMetadata: {},
      schemaMetadata: {},
      schemaState: {
        state: 'finished',
        schema: options.schema,
        schemaId: schemaId,
      },
    }
  }

  public async getCredentialDefinition(
    _agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    const credentialDefinition = this.credentialDefinitions[credentialDefinitionId]

    if (!credentialDefinition) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Credential definition with id ${credentialDefinitionId} not found in memory registry`,
        },
        credentialDefinitionId,
        credentialDefinitionMetadata: {},
      }
    }

    let didIndyNamespace: string | undefined
    if (isUnqualifiedCredentialDefinitionId(credentialDefinitionId)) {
      const { namespaceIdentifier, schemaSeqNo, tag } = parseIndyCredentialDefinitionId(credentialDefinitionId)
      const qualifiedCredDefEnding = `${namespaceIdentifier}/anoncreds/v0/CLAIM_DEF/${schemaSeqNo}/${tag}`
      const unqualifiedCredDefId = Object.keys(this.credentialDefinitions).find((credentialDefinitionId) =>
        credentialDefinitionId.endsWith(qualifiedCredDefEnding)
      )
      didIndyNamespace = unqualifiedCredDefId
        ? parseIndyCredentialDefinitionId(unqualifiedCredDefId).namespace
        : undefined
    } else if (isIndyDid(credentialDefinitionId)) {
      didIndyNamespace = parseIndyCredentialDefinitionId(credentialDefinitionId).namespace
    }

    return {
      resolutionMetadata: {},
      credentialDefinition,
      credentialDefinitionId,
      credentialDefinitionMetadata: { ...(didIndyNamespace && { didIndyNamespace }) },
    }
  }

  public async registerCredentialDefinition(
    _agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    const schemaId = options.credentialDefinition.schemaId

    let credentialDefinitionId: string
    if (isIndyDid(options.credentialDefinition.issuerId)) {
      const parsedSchema = parseIndySchemaId(options.credentialDefinition.schemaId)
      const legacySchemaId = getUnqualifiedSchemaId(
        parsedSchema.namespaceIdentifier,
        parsedSchema.schemaName,
        parsedSchema.schemaVersion
      )
      const indyLedgerSeqNo = getSeqNoFromSchemaId(legacySchemaId)

      const { namespace, namespaceIdentifier: legacyIssuerId } = parseIndyDid(options.credentialDefinition.issuerId)
      const didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
        namespace,
        legacyIssuerId,
        indyLedgerSeqNo,
        options.credentialDefinition.tag
      )

      this.credentialDefinitions[getUnQualifiedDidIndyDid(didIndyCredentialDefinitionId)] = {
        ...options.credentialDefinition,
        issuerId: legacyIssuerId,
        schemaId: legacySchemaId,
      }
      credentialDefinitionId = didIndyCredentialDefinitionId
    } else if (schemaId.startsWith('did:cheqd:')) {
      credentialDefinitionId = `${options.credentialDefinition.issuerId}/resources/${utils.uuid()}`
    } else {
      throw new Error(`Cannot register Credential Definition. Unsupported schemaId '${schemaId}'`)
    }

    this.credentialDefinitions[credentialDefinitionId] = options.credentialDefinition
    return {
      registrationMetadata: {},
      credentialDefinitionMetadata: {},
      credentialDefinitionState: {
        state: 'finished',
        credentialDefinition: options.credentialDefinition,
        credentialDefinitionId,
      },
    }
  }

  public async getRevocationRegistryDefinition(
    _agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    const revocationRegistryDefinition = this.revocationRegistryDefinitions[revocationRegistryDefinitionId]

    if (!revocationRegistryDefinition) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Revocation registry definition with id ${revocationRegistryDefinition} not found in memory registry`,
        },
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {},
      }
    }

    let didIndyNamespace: string | undefined
    if (isUnqualifiedCredentialDefinitionId(revocationRegistryDefinitionId)) {
      const { namespaceIdentifier, schemaSeqNo, revocationRegistryTag } =
        parseIndyRevocationRegistryId(revocationRegistryDefinitionId)
      const qualifiedRevRegIdEnding = `:${namespaceIdentifier}/anoncreds/v0/REV_REG_DEF/${schemaSeqNo}/${revocationRegistryTag}`
      const unqualifiedRevRegId = Object.keys(this.revocationRegistryDefinitions).find((revocationRegistryId) =>
        revocationRegistryId.endsWith(qualifiedRevRegIdEnding)
      )
      didIndyNamespace = unqualifiedRevRegId ? parseIndySchemaId(unqualifiedRevRegId).namespace : undefined
    } else if (isIndyDid(revocationRegistryDefinitionId)) {
      didIndyNamespace = parseIndyRevocationRegistryId(revocationRegistryDefinitionId).namespace
    }

    return {
      resolutionMetadata: {},
      revocationRegistryDefinition,
      revocationRegistryDefinitionId,
      revocationRegistryDefinitionMetadata: { ...(didIndyNamespace && { didIndyNamespace }) },
    }
  }

  public async registerRevocationRegistryDefinition(
    _agentContext: AgentContext,
    options: RegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    const parsedCredentialDefinition = parseIndyCredentialDefinitionId(options.revocationRegistryDefinition.credDefId)
    const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(
      parsedCredentialDefinition.namespaceIdentifier,
      parsedCredentialDefinition.schemaSeqNo,
      parsedCredentialDefinition.tag
    )
    const indyLedgerSeqNo = getSeqNoFromSchemaId(legacyCredentialDefinitionId)

    const { namespace, namespaceIdentifier } = parseIndyDid(options.revocationRegistryDefinition.issuerId)
    const legacyIssuerId = namespaceIdentifier
    const didIndyRevocationRegistryDefinitionId = getDidIndyRevocationRegistryDefinitionId(
      namespace,
      namespaceIdentifier,
      indyLedgerSeqNo,
      parsedCredentialDefinition.tag,
      options.revocationRegistryDefinition.tag
    )

    this.revocationRegistryDefinitions[didIndyRevocationRegistryDefinitionId] = options.revocationRegistryDefinition

    const legacyRevocationRegistryDefinitionId = getUnqualifiedRevocationRegistryDefinitionId(
      legacyIssuerId,
      indyLedgerSeqNo,
      parsedCredentialDefinition.tag,
      options.revocationRegistryDefinition.tag
    )

    this.revocationRegistryDefinitions[legacyRevocationRegistryDefinitionId] = {
      ...options.revocationRegistryDefinition,
      issuerId: legacyIssuerId,
      credDefId: legacyCredentialDefinitionId,
    }

    return {
      registrationMetadata: {},
      revocationRegistryDefinitionMetadata: {},
      revocationRegistryDefinitionState: {
        state: 'finished',
        revocationRegistryDefinition: options.revocationRegistryDefinition,
        revocationRegistryDefinitionId: didIndyRevocationRegistryDefinitionId,
      },
    }
  }

  public async getRevocationStatusList(
    _agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    const revocationStatusLists = this.revocationStatusLists[revocationRegistryId]

    if (!revocationStatusLists || Object.entries(revocationStatusLists).length === 0) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Revocation status list for revocation registry with id ${revocationRegistryId} not found in memory registry`,
        },
        revocationStatusListMetadata: {},
      }
    }

    const previousTimestamps = Object.keys(revocationStatusLists)
      .filter((ts) => Number(ts) <= timestamp)
      .sort()

    if (!previousTimestamps) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `No active Revocation status list found at ${timestamp} for revocation registry with id ${revocationRegistryId}`,
        },
        revocationStatusListMetadata: {},
      }
    }

    return {
      resolutionMetadata: {},
      revocationStatusList: revocationStatusLists[previousTimestamps[previousTimestamps.length - 1]],
      revocationStatusListMetadata: {},
    }
  }

  public async registerRevocationStatusList(
    _agentContext: AgentContext,
    options: RegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    const timestamp = (options.options.timestamp as number) ?? dateToTimestamp(new Date())
    const revocationStatusList = {
      ...options.revocationStatusList,
      timestamp,
    } satisfies AnonCredsRevocationStatusList
    if (!this.revocationStatusLists[options.revocationStatusList.revRegDefId]) {
      this.revocationStatusLists[options.revocationStatusList.revRegDefId] = {}
    }

    this.revocationStatusLists[revocationStatusList.revRegDefId][timestamp.toString()] = revocationStatusList
    return {
      registrationMetadata: {},
      revocationStatusListMetadata: {},
      revocationStatusListState: {
        state: 'finished',
        revocationStatusList,
      },
    }
  }
}

/**
 * Calculates a consistent sequence number for a given schema id.
 *
 * Does this by hashing the schema id, transforming the hash to a number and taking the first 6 digits.
 */
function getSeqNoFromSchemaId(schemaId: string) {
  const hash = Hasher.hash(schemaId, 'sha-256')
  return bytesToBigint(hash).toString().slice(0, 5)
}
