import type { CheqdCreateResourceOptions } from '../../dids'
import type {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaReturn,
  RegisterSchemaOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import { AriesFrameworkError, Buffer, Hasher, JsonTransformer, TypedArrayEncoder, utils } from '@aries-framework/core'

import { CheqdDidResolver, CheqdDidRegistrar } from '../../dids'
import { cheqdSdkAnonCredsRegistryIdentifierRegex, parseCheqdDid } from '../utils/identifiers'
import {
  CheqdCredentialDefinition,
  CheqdRevocationRegistryDefinition,
  CheqdRevocationStatusList,
  CheqdSchema,
} from '../utils/transform'

export class CheqdAnonCredsRegistry implements AnonCredsRegistry {
  public methodName = 'cheqd'

  /**
   * This class supports resolving and registering objects with cheqd identifiers.
   * It needs to include support for the schema, credential definition, revocation registry as well
   * as the issuer id (which is needed when registering objects).
   */
  public readonly supportedIdentifier = cheqdSdkAnonCredsRegistryIdentifierRegex

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)
      const parsedDid = parseCheqdDid(schemaId)
      if (!parsedDid) {
        throw new Error(`Invalid schemaId: ${schemaId}`)
      }

      agentContext.config.logger.trace(`Submitting get schema request for schema '${schemaId}' to ledger`)

      const response = await cheqdDidResolver.resolveResource(agentContext, schemaId)
      const schema = JsonTransformer.fromJSON(response.resource, CheqdSchema)

      return {
        schema: {
          attrNames: schema.attrNames,
          name: schema.name,
          version: schema.version,
          issuerId: parsedDid.did,
        },
        schemaId,
        resolutionMetadata: {},
        schemaMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving schema '${schemaId}'`, {
        error,
        schemaId,
      })

      return {
        schemaId,
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve schema: ${error.message}`,
        },
        schemaMetadata: {},
      }
    }
  }

  public async registerSchema(
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    try {
      const cheqdDidRegistrar = agentContext.dependencyManager.resolve(CheqdDidRegistrar)

      const schema = options.schema
      const schemaResource = {
        id: utils.uuid(),
        name: `${schema.name}-Schema`,
        resourceType: 'anonCredsSchema',
        data: {
          name: schema.name,
          version: schema.version,
          attrNames: schema.attrNames,
        },
        version: schema.version,
      } satisfies CheqdCreateResourceOptions

      const response = await cheqdDidRegistrar.createResource(agentContext, schema.issuerId, schemaResource)
      if (response.resourceState.state !== 'finished') {
        throw new Error(response.resourceState.reason)
      }

      return {
        schemaState: {
          state: 'finished',
          schema,
          schemaId: `${schema.issuerId}/resources/${schemaResource.id}`,
        },
        registrationMetadata: {},
        schemaMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.debug(`Error registering schema for did '${options.schema.issuerId}'`, {
        error,
        did: options.schema.issuerId,
        schema: options,
      })

      return {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'failed',
          schema: options.schema,
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    try {
      const cheqdDidRegistrar = agentContext.dependencyManager.resolve(CheqdDidRegistrar)
      const { credentialDefinition } = options
      const schema = await this.getSchema(agentContext, credentialDefinition.schemaId)
      if (!schema.schema) {
        throw new Error(`Schema not found for schemaId: ${credentialDefinition.schemaId}`)
      }

      const credDefName = `${schema.schema.name}-${credentialDefinition.tag}`
      const credDefNameHashBuffer = Hasher.hash(Buffer.from(credDefName), 'sha2-256')

      const credDefResource = {
        id: utils.uuid(),
        name: TypedArrayEncoder.toHex(credDefNameHashBuffer),
        resourceType: 'anonCredsCredDef',
        data: {
          type: credentialDefinition.type,
          tag: credentialDefinition.tag,
          value: credentialDefinition.value,
          schemaId: credentialDefinition.schemaId,
        },
        version: utils.uuid(),
      } satisfies CheqdCreateResourceOptions

      const response = await cheqdDidRegistrar.createResource(
        agentContext,
        credentialDefinition.issuerId,
        credDefResource
      )
      if (response.resourceState.state !== 'finished') {
        throw new Error(response.resourceState.reason)
      }

      return {
        credentialDefinitionState: {
          state: 'finished',
          credentialDefinition,
          credentialDefinitionId: `${credentialDefinition.issuerId}/resources/${credDefResource.id}`,
        },
        registrationMetadata: {},
        credentialDefinitionMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering credential definition for did '${options.credentialDefinition.issuerId}'`,
        {
          error,
          did: options.credentialDefinition.issuerId,
          schema: options,
        }
      )

      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'failed',
          credentialDefinition: options.credentialDefinition,
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    try {
      const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)
      const parsedDid = parseCheqdDid(credentialDefinitionId)
      if (!parsedDid) {
        throw new Error(`Invalid credentialDefinitionId: ${credentialDefinitionId}`)
      }

      agentContext.config.logger.trace(
        `Submitting get credential definition request for '${credentialDefinitionId}' to ledger`
      )

      const response = await cheqdDidResolver.resolveResource(agentContext, credentialDefinitionId)
      const credentialDefinition = JsonTransformer.fromJSON(response.resource, CheqdCredentialDefinition)
      return {
        credentialDefinition: {
          ...credentialDefinition,
          issuerId: parsedDid.did,
        },
        credentialDefinitionId,
        resolutionMetadata: {},
        credentialDefinitionMetadata: (response.resourceMetadata ?? {}) as Record<string, unknown>,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving credential definition '${credentialDefinitionId}'`, {
        error,
        credentialDefinitionId,
      })

      return {
        credentialDefinitionId,
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve credential definition: ${error.message}`,
        },
        credentialDefinitionMetadata: {},
      }
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)
      const parsedDid = parseCheqdDid(revocationRegistryDefinitionId)
      if (!parsedDid) {
        throw new Error(`Invalid revocationRegistryDefinitionId: ${revocationRegistryDefinitionId}`)
      }

      agentContext.config.logger.trace(
        `Submitting get revocation registry definition request for '${revocationRegistryDefinitionId}' to ledger`
      )

      const response = await cheqdDidResolver.resolveResource(
        agentContext,
        `${revocationRegistryDefinitionId}&resourceType=anonCredsRevocRegDef`
      )
      const revocationRegistryDefinition = JsonTransformer.fromJSON(
        response.resource,
        CheqdRevocationRegistryDefinition
      )
      return {
        revocationRegistryDefinition: {
          ...revocationRegistryDefinition,
          issuerId: parsedDid.did,
        },
        revocationRegistryDefinitionId,
        resolutionMetadata: {},
        revocationRegistryDefinitionMetadata: (response.resourceMetadata ?? {}) as Record<string, unknown>,
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}'`,
        {
          error,
          revocationRegistryDefinitionId,
        }
      )

      return {
        revocationRegistryDefinitionId,
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve revocation registry definition: ${error.message}`,
        },
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  public async registerRevocationRegistryDefinition(): Promise<RegisterRevocationRegistryDefinitionReturn> {
    throw new Error('Not implemented!')
  }

  // FIXME: this method doesn't retrieve the revocation status list at a specified time, it just resolves the revocation registry definition
  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    try {
      const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)
      const parsedDid = parseCheqdDid(revocationRegistryId)
      if (!parsedDid) {
        throw new Error(`Invalid revocationRegistryId: ${revocationRegistryId}`)
      }

      agentContext.config.logger.trace(
        `Submitting get revocation status request for '${revocationRegistryId}' to ledger`
      )

      const response = await cheqdDidResolver.resolveResource(
        agentContext,
        `${revocationRegistryId}&resourceType=anonCredsStatusList&resourceVersionTime=${timestamp}`
      )
      const revocationStatusList = JsonTransformer.fromJSON(response.resource, CheqdRevocationStatusList)

      const statusListTimestamp = response.resourceMetadata?.created?.getUTCSeconds()
      if (!statusListTimestamp) {
        throw new AriesFrameworkError(
          `Unable to extract revocation status list timestamp from resource ${revocationRegistryId}`
        )
      }

      return {
        revocationStatusList: {
          ...revocationStatusList,
          issuerId: parsedDid.did,
          timestamp: statusListTimestamp,
        },
        resolutionMetadata: {},
        revocationStatusListMetadata: (response.resourceMetadata ?? {}) as Record<string, unknown>,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving revocation registry status list '${revocationRegistryId}'`, {
        error,
        revocationRegistryId,
      })

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve revocation registry status list: ${error.message}`,
        },
        revocationStatusListMetadata: {},
      }
    }
  }

  public async registerRevocationStatusList(): Promise<RegisterRevocationStatusListReturn> {
    throw new Error('Not implemented!')
  }
}
