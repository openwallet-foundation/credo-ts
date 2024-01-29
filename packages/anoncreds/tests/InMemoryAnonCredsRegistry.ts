import type {
  AnonCredsRegistry,
  GetSchemaReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
  GetCredentialDefinitionReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  AnonCredsRevocationStatusList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListReturn,
  RegisterRevocationStatusListOptions,
} from '../src'
import type { AgentContext } from '@aries-framework/core'

import { Hasher, TypedArrayEncoder } from '@aries-framework/core'
import BigNumber from 'bn.js'

import {
  getDidIndyCredentialDefinitionId,
  getDidIndyRevocationRegistryDefinitionId,
  getDidIndySchemaId,
} from '../../indy-sdk/src/anoncreds/utils/identifiers'
import {
  parseIndyCredentialDefinitionId,
  getUnqualifiedRevocationRegistryDefinitionId,
  getUnqualifiedCredentialDefinitionId,
  getUnqualifiedSchemaId,
  parseIndyDid,
  parseIndySchemaId,
} from '../src'
import { dateToTimestamp } from '../src/utils/timestamp'

/**
 * In memory implementation of the {@link AnonCredsRegistry} interface. Useful for testing.
 */
export class InMemoryAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'inMemory'

  // Roughly match that the identifier starts with an unqualified indy did. Once the
  // anoncreds tests are not based on the indy-sdk anymore, we can use any identifier
  // we want, but the indy-sdk is picky about the identifier format.
  public readonly supportedIdentifier = /.+/

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

    const parsed = parseIndySchemaId(schemaId)

    const legacySchemaId = getUnqualifiedSchemaId(parsed.namespaceIdentifier, parsed.schemaName, parsed.schemaVersion)
    const indyLedgerSeqNo = getSeqNoFromSchemaId(legacySchemaId)

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

    return {
      resolutionMetadata: {},
      schema,
      schemaId,
      schemaMetadata: {
        // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
        // For this reason we return it in the metadata.
        indyLedgerSeqNo,
      },
    }
  }

  public async registerSchema(
    _agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    const { namespace, namespaceIdentifier } = parseIndyDid(options.schema.issuerId)
    const legacyIssuerId = namespaceIdentifier
    const didIndySchemaId = getDidIndySchemaId(
      namespace,
      namespaceIdentifier,
      options.schema.name,
      options.schema.version
    )
    this.schemas[didIndySchemaId] = options.schema

    const legacySchemaId = getUnqualifiedSchemaId(legacyIssuerId, options.schema.name, options.schema.version)
    const indyLedgerSeqNo = getSeqNoFromSchemaId(legacySchemaId)

    this.schemas[legacySchemaId] = {
      ...options.schema,
      issuerId: legacyIssuerId,
    }

    return {
      registrationMetadata: {},
      schemaMetadata: {
        // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
        // For this reason we return it in the metadata.
        indyLedgerSeqNo,
      },
      schemaState: {
        state: 'finished',
        schema: options.schema,
        schemaId: didIndySchemaId,
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

    return {
      resolutionMetadata: {},
      credentialDefinition,
      credentialDefinitionId,
      credentialDefinitionMetadata: {},
    }
  }

  public async registerCredentialDefinition(
    _agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    const parsedSchema = parseIndySchemaId(options.credentialDefinition.schemaId)
    const legacySchemaId = getUnqualifiedSchemaId(
      parsedSchema.namespaceIdentifier,
      parsedSchema.schemaName,
      parsedSchema.schemaVersion
    )
    const indyLedgerSeqNo = getSeqNoFromSchemaId(legacySchemaId)

    const { namespace, namespaceIdentifier } = parseIndyDid(options.credentialDefinition.issuerId)
    const legacyIssuerId = namespaceIdentifier
    const didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
      namespace,
      namespaceIdentifier,
      indyLedgerSeqNo,
      options.credentialDefinition.tag
    )

    this.credentialDefinitions[didIndyCredentialDefinitionId] = options.credentialDefinition

    const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(
      legacyIssuerId,
      indyLedgerSeqNo,
      options.credentialDefinition.tag
    )

    this.credentialDefinitions[legacyCredentialDefinitionId] = {
      ...options.credentialDefinition,
      issuerId: legacyIssuerId,
      schemaId: legacySchemaId,
    }

    return {
      registrationMetadata: {},
      credentialDefinitionMetadata: {},
      credentialDefinitionState: {
        state: 'finished',
        credentialDefinition: options.credentialDefinition,
        credentialDefinitionId: didIndyCredentialDefinitionId,
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

    return {
      resolutionMetadata: {},
      revocationRegistryDefinition,
      revocationRegistryDefinitionId,
      revocationRegistryDefinitionMetadata: {},
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
  const seqNo = Number(
    new BigNumber(Hasher.hash(TypedArrayEncoder.fromString(schemaId), 'sha2-256')).toString().slice(0, 5)
  )

  return seqNo
}
