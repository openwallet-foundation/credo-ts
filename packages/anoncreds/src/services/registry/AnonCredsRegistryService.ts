import type { AgentContext } from '@credo-ts/core'
import { CacheModuleConfig, injectable } from '@credo-ts/core'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsError } from '../../error'
import {
  AnonCredsCredentialDefinitionRepository,
  AnonCredsRevocationRegistryDefinitionRepository,
  AnonCredsSchemaRepository,
} from '../../repository'
import { AnonCredsCredentialDefinitionRecordMetadataKeys } from '../../repository/anonCredsCredentialDefinitionRecordMetadataTypes'
import { AnonCredsRevocationRegistryDefinitionRecordMetadataKeys } from '../../repository/anonCredsRevocationRegistryDefinitionRecordMetadataTypes'
import type { AnonCredsRegistry } from './AnonCredsRegistry'
import type { AnonCredsResolutionOptions, Extensible } from './base'
import type { GetCredentialDefinitionReturn } from './CredentialDefinitionOptions'
import type { GetRevocationRegistryDefinitionReturn } from './RevocationRegistryDefinitionOptions'
import type { GetRevocationStatusListReturn } from './RevocationStatusListOptions'
import type { GetSchemaReturn } from './SchemaOptions'

/**
 * @internal
 * The AnonCreds registry service manages multiple {@link AnonCredsRegistry} instances
 * and returns the correct registry based on a given identifier
 */
@injectable()
export class AnonCredsRegistryService {
  public async getSchema(
    agentContext: AgentContext,
    schemaId: string,
    options: AnonCredsResolutionOptions = {}
  ): Promise<GetSchemaReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve schema ${schemaId}`,
      },
      schemaId,
      schemaMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(agentContext, schemaId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve schema ${schemaId}: No registry found for identifier ${schemaId}`
      return failedReturnBase
    }

    // extract caching options and set defaults
    const { useCache = true, cacheDurationInSeconds = 300, persistInCache = true, useLocalRecord = true } = options
    const cacheKey = this.getCacheKey('schema', schemaId)

    if (registry.allowsCaching && useCache) {
      const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

      // FIXME: in multi-tenancy it can be that the same cache is used for different agent contexts
      // This may become a problem when resolving schemas, as you can get back a cache hit for a different
      // tenant. We should just recommend disabling caching where the results are tenant specific
      // We could allow providing a custom cache prefix in the resolver options, so that the cache key
      // can be recognized in the cache implementation
      const cachedSchema = await cache.get<GetSchemaReturn>(agentContext, cacheKey)

      if (cachedSchema) {
        return {
          ...cachedSchema,
          resolutionMetadata: {
            ...cachedSchema.resolutionMetadata,
            servedFromCache: true,
          },
        }
      }
    }

    if (registry.allowsLocalRecord && useLocalRecord) {
      const anonCredsSchemaRepository = agentContext.resolve(AnonCredsSchemaRepository)
      const schemaRecord = await anonCredsSchemaRepository.findSingleByQuery(agentContext, {
        schemaId,
      })

      if (schemaRecord) {
        return {
          schemaId,
          schema: schemaRecord.schema,
          schemaMetadata: {},
          resolutionMetadata: {
            servedFromCache: false,
            servedFromRecord: true,
          },
        }
      }
    }

    try {
      const result = await registry.getSchema(agentContext, schemaId)

      if (result.schema && registry.allowsCaching && persistInCache) {
        const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
        await cache.set(
          agentContext,
          cacheKey,
          result,
          // Set cache duration
          cacheDurationInSeconds
        )
      }

      return {
        ...result,
        resolutionMetadata: {
          ...result.resolutionMetadata,
          servedFromCache: result.resolutionMetadata.servedFromCache ?? false,
        },
      }
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve schema ${schemaId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string,
    options: AnonCredsResolutionOptions = {}
  ): Promise<GetCredentialDefinitionReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve credential definition ${credentialDefinitionId}`,
      },
      credentialDefinitionId,
      credentialDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(agentContext, credentialDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve credential definition ${credentialDefinitionId}: No registry found for identifier ${credentialDefinitionId}`
      return failedReturnBase
    }

    // extract caching options and set defaults
    const { useCache = true, cacheDurationInSeconds = 300, persistInCache = true, useLocalRecord = true } = options
    const cacheKey = this.getCacheKey('credentialDefinition', credentialDefinitionId)

    if (registry.allowsCaching && useCache) {
      const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

      // FIXME: in multi-tenancy it can be that the same cache is used for different agent contexts
      // This may become a problem when resolving schemas, as you can get back a cache hit for a different
      // tenant. We should just recommend disabling caching where the results are tenant specific
      // We could allow providing a custom cache prefix in the resolver options, so that the cache key
      // can be recognized in the cache implementation
      const cachedCredentialDefinition = await cache.get<GetCredentialDefinitionReturn>(agentContext, cacheKey)

      if (cachedCredentialDefinition) {
        return {
          ...cachedCredentialDefinition,
          resolutionMetadata: {
            ...cachedCredentialDefinition.resolutionMetadata,
            servedFromCache: true,
          },
        }
      }
    }

    if (registry.allowsLocalRecord && useLocalRecord) {
      const anonCredsCredentialDefinitionRepository = agentContext.resolve(AnonCredsCredentialDefinitionRepository)
      const credentialDefinitionRecord = await anonCredsCredentialDefinitionRepository.findSingleByQuery(agentContext, {
        credentialDefinitionId,
      })

      if (credentialDefinitionRecord) {
        return {
          credentialDefinitionId,
          credentialDefinition: credentialDefinitionRecord.credentialDefinition,
          credentialDefinitionMetadata:
            credentialDefinitionRecord.metadata.get(
              AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionMetadata
            ) ?? {},
          resolutionMetadata: {
            servedFromCache: false,
            servedFromRecord: true,
          },
        }
      }
    }

    try {
      const result = await registry.getCredentialDefinition(agentContext, credentialDefinitionId)

      if (result.credentialDefinition && registry.allowsCaching && persistInCache) {
        const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
        await cache.set(
          agentContext,
          cacheKey,
          result,
          // Set cache duration
          cacheDurationInSeconds
        )
      }

      return {
        ...result,
        resolutionMetadata: {
          ...result.resolutionMetadata,
          servedFromCache: result.resolutionMetadata.servedFromCache ?? false,
        },
      }
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve credential definition ${credentialDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    options: AnonCredsResolutionOptions = {}
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve revocation registry ${revocationRegistryDefinitionId}`,
      },
      revocationRegistryDefinitionId,
      revocationRegistryDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(agentContext, revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation registry ${revocationRegistryDefinitionId}: No registry found for identifier ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    // extract caching options and set defaults
    const { useCache = true, cacheDurationInSeconds = 300, persistInCache = true, useLocalRecord = true } = options
    const cacheKey = this.getCacheKey('revocationRegistryDefinition', revocationRegistryDefinitionId)

    if (registry.allowsCaching && useCache) {
      const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

      // FIXME: in multi-tenancy it can be that the same cache is used for different agent contexts
      // This may become a problem when resolving schemas, as you can get back a cache hit for a different
      // tenant. We should just recommend disabling caching where the results are tenant specific
      // We could allow providing a custom cache prefix in the resolver options, so that the cache key
      // can be recognized in the cache implementation
      const cachedRevocationRegistryDefinition = await cache.get<GetRevocationRegistryDefinitionReturn>(
        agentContext,
        cacheKey
      )

      if (cachedRevocationRegistryDefinition) {
        return {
          ...cachedRevocationRegistryDefinition,
          resolutionMetadata: {
            ...cachedRevocationRegistryDefinition.resolutionMetadata,
            servedFromCache: true,
          },
        }
      }
    }

    if (registry.allowsLocalRecord && useLocalRecord) {
      const anoncredsRevocationRegistryDefinitionRepository = agentContext.resolve(
        AnonCredsRevocationRegistryDefinitionRepository
      )
      const anoncredsRevocationRegistryDefinitionRecord =
        await anoncredsRevocationRegistryDefinitionRepository.findSingleByQuery(agentContext, {
          revocationRegistryDefinitionId,
        })

      if (anoncredsRevocationRegistryDefinitionRecord) {
        return {
          revocationRegistryDefinitionId,
          revocationRegistryDefinition: anoncredsRevocationRegistryDefinitionRecord.revocationRegistryDefinition,
          revocationRegistryDefinitionMetadata:
            anoncredsRevocationRegistryDefinitionRecord.metadata.get<Extensible>(
              AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionMetadata
            ) ?? {},
          resolutionMetadata: {
            servedFromCache: false,
            servedFromRecord: true,
          },
        }
      }
    }

    try {
      const result = await registry.getRevocationRegistryDefinition(agentContext, revocationRegistryDefinitionId)

      if (result.revocationRegistryDefinition && registry.allowsCaching && persistInCache) {
        const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
        await cache.set(
          agentContext,
          cacheKey,
          result,
          // Set cache duration
          cacheDurationInSeconds
        )
      }

      return {
        ...result,
        resolutionMetadata: {
          ...result.resolutionMetadata,
          servedFromCache: result.resolutionMetadata.servedFromCache ?? false,
        },
      }
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation registry definition ${revocationRegistryDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: number,
    // No record for status list
    options: Omit<AnonCredsResolutionOptions, 'useLocalRecord'> = {}
  ): Promise<GetRevocationStatusListReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}`,
      },
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(agentContext, revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}: No registry found for identifier ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    // extract caching options and set defaults
    const { useCache = true, cacheDurationInSeconds = 300, persistInCache = true } = options
    const cacheKey = this.getCacheKey('revocationStatusList', `${revocationRegistryDefinitionId}:${timestamp}`)

    if (registry.allowsCaching && useCache) {
      const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

      // FIXME: in multi-tenancy it can be that the same cache is used for different agent contexts
      // This may become a problem when resolving schemas, as you can get back a cache hit for a different
      // tenant. We should just recommend disabling caching where the results are tenant specific
      // We could allow providing a custom cache prefix in the resolver options, so that the cache key
      // can be recognized in the cache implementation
      const cachedRevocationStatusList = await cache.get<GetRevocationStatusListReturn>(agentContext, cacheKey)

      if (cachedRevocationStatusList) {
        return {
          ...cachedRevocationStatusList,
          resolutionMetadata: {
            ...cachedRevocationStatusList.resolutionMetadata,
            servedFromCache: true,
          },
        }
      }
    }

    try {
      const result = await registry.getRevocationStatusList(agentContext, revocationRegistryDefinitionId, timestamp)

      if (result.revocationStatusList && registry.allowsCaching && persistInCache) {
        const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
        await cache.set(
          agentContext,
          cacheKey,
          result,
          // Set cache duration
          cacheDurationInSeconds
        )
      }

      return {
        ...result,
        resolutionMetadata: {
          ...result.resolutionMetadata,
          servedFromCache: result.resolutionMetadata.servedFromCache ?? false,
        },
      }
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  public getRegistryForIdentifier(agentContext: AgentContext, identifier: string): AnonCredsRegistry {
    const registries = agentContext.dependencyManager.resolve(AnonCredsModuleConfig).registries

    // TODO: should we check if multiple are registered?
    const registry = registries.find((registry) => registry.supportedIdentifier.test(identifier))

    if (!registry) {
      throw new AnonCredsError(`No AnonCredsRegistry registered for identifier '${identifier}'`)
    }

    return registry
  }

  private findRegistryForIdentifier(agentContext: AgentContext, identifier: string) {
    try {
      return this.getRegistryForIdentifier(agentContext, identifier)
    } catch {
      return null
    }
  }

  private getCacheKey(
    resourceType: 'schema' | 'credentialDefinition' | 'revocationRegistryDefinition' | 'revocationStatusList',
    identifier: string
  ) {
    return `anoncreds:resolver:${resourceType}:${identifier}`
  }
}
