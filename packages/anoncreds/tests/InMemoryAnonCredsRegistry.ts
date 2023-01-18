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
  GetRevocationListReturn,
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
} from '../src'
import type { AgentContext } from '@aries-framework/core'

import { Hasher, TypedArrayEncoder } from '@aries-framework/core'
import BigNumber from 'bn.js'

/**
 * In memory implementation of the {@link AnonCredsRegistry} interface. Useful for testing.
 */
export class InMemoryAnonCredsRegistry implements AnonCredsRegistry {
  // Roughly match that the identifier starts with an unqualified indy did. Once the
  // anoncreds tests are not based on the indy-sdk anymore, we can use any identifier
  // we want, but the indy-sdk is picky about the identifier format.
  public readonly supportedIdentifier = /^[a-zA-Z0-9]{21,22}/

  private schemas: Record<string, AnonCredsSchema> = {}
  private credentialDefinitions: Record<string, AnonCredsCredentialDefinition> = {}

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    const schema = this.schemas[schemaId]
    const indyLedgerSeqNo = getSeqNoFromSchemaId(schemaId)

    if (!schema) {
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Schema with id ${schemaId} not found in memory registry`,
        },
        schema: null,
        schemaId,
        schemaMetadata: {
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          indyLedgerSeqNo,
        },
      }
    }

    return {
      resolutionMetadata: {},
      schema,
      schemaId,
      schemaMetadata: {},
    }
  }

  public async registerSchema(
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    const schemaId = `${options.schema.issuerId}:2:${options.schema.name}:${options.schema.version}`
    const indyLedgerSeqNo = getSeqNoFromSchemaId(schemaId)

    this.schemas[schemaId] = options.schema

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
        schemaId,
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
        credentialDefinition: null,
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
    const indyLedgerSeqNo = getSeqNoFromSchemaId(options.credentialDefinition.schemaId)
    const credentialDefinitionId = `${options.credentialDefinition.issuerId}:3:CL:${indyLedgerSeqNo}:${options.credentialDefinition.tag}`

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

  public getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    throw new Error('Method not implemented.')
  }

  public getRevocationList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationListReturn> {
    throw new Error('Method not implemented.')
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
