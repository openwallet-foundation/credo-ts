/* eslint-disable @typescript-eslint/no-unused-vars */
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
} from '../src'
import type { AgentContext } from '@aries-framework/core'

import { Hasher, TypedArrayEncoder } from '@aries-framework/core'
import BigNumber from 'bn.js'

import {
  getDidIndyCredentialDefinitionId,
  getDidIndySchemaId,
  getLegacyCredentialDefinitionId,
  getLegacySchemaId,
  parseSchemaId,
} from '../../indy-sdk/src/anoncreds/utils/identifiers'
import { parseIndyDid } from '../../indy-sdk/src/dids/didIndyUtil'

/**
 * In memory implementation of the {@link AnonCredsRegistry} interface. Useful for testing.
 */
export class InMemoryAnonCredsRegistry implements AnonCredsRegistry {
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

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    const schema = this.schemas[schemaId]

    const parsed = parseSchemaId(schemaId)

    const legacySchemaId = getLegacySchemaId(parsed.namespaceIdentifier, parsed.schemaName, parsed.schemaVersion)
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
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    const { namespaceIdentifier, namespace } = parseIndyDid(options.schema.issuerId)
    const didIndySchemaId = getDidIndySchemaId(
      namespace,
      namespaceIdentifier,
      options.schema.name,
      options.schema.version
    )
    const legacySchemaId = getLegacySchemaId(namespaceIdentifier, options.schema.name, options.schema.version)

    const indyLedgerSeqNo = getSeqNoFromSchemaId(legacySchemaId)

    this.schemas[didIndySchemaId] = options.schema
    this.schemas[legacySchemaId] = {
      ...options.schema,
      issuerId: namespaceIdentifier,
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
    agentContext: AgentContext,
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
    agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    const parsedSchema = parseSchemaId(options.credentialDefinition.schemaId)
    const legacySchemaId = getLegacySchemaId(
      parsedSchema.namespaceIdentifier,
      parsedSchema.schemaName,
      parsedSchema.schemaVersion
    )
    const indyLedgerSeqNo = getSeqNoFromSchemaId(legacySchemaId)

    const { namespaceIdentifier, namespace } = parseIndyDid(options.credentialDefinition.issuerId)

    const didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
      namespace,
      namespaceIdentifier,
      indyLedgerSeqNo,
      options.credentialDefinition.tag
    )
    const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(
      namespaceIdentifier,
      indyLedgerSeqNo,
      options.credentialDefinition.tag
    )

    this.credentialDefinitions[didIndyCredentialDefinitionId] = options.credentialDefinition
    this.credentialDefinitions[legacyCredentialDefinitionId] = {
      ...options.credentialDefinition,
      issuerId: namespaceIdentifier,
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
    agentContext: AgentContext,
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

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    const revocationStatusLists = this.revocationStatusLists[revocationRegistryId]

    if (!revocationStatusLists || !revocationStatusLists[timestamp]) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Revocation status list for revocation registry with id ${revocationRegistryId} not found in memory registry`,
        },
        revocationStatusListMetadata: {},
      }
    }

    return {
      resolutionMetadata: {},
      revocationStatusList: revocationStatusLists[timestamp],
      revocationStatusListMetadata: {},
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
