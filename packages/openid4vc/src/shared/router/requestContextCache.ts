import {
  type AgentContext,
  type BaseRecord,
  CacheModuleConfig,
  JsonTransformer,
  SingleContextStorageLruCache,
} from '@credo-ts/core'
import { defaultOpenId4VcRequestContextCacheOptions, OpenId4VcModuleConfig } from '../../OpenId4VcModuleConfig'

let hasWarnedAboutCache = false

function getCache(agentContext: AgentContext) {
  const { dependencyManager } = agentContext
  // The issuer and verifier modules can be registered without the OpenId4VcModule
  const options = dependencyManager.isRegistered(OpenId4VcModuleConfig, true)
    ? dependencyManager.resolve(OpenId4VcModuleConfig).requestContextCache
    : defaultOpenId4VcRequestContextCacheOptions
  if (!options) return undefined

  const cache = agentContext.resolve(CacheModuleConfig).cache

  // This cache writes to storage on every change and only supports one agent context
  if (cache instanceof SingleContextStorageLruCache) {
    if (!hasWarnedAboutCache) {
      agentContext.config.logger.warn(
        "The OpenID4VC request context cache is not used with the 'SingleContextStorageLruCache'. Register the 'CacheModule' with another cache, such as the 'InMemoryLruCache' or the 'RedisCache' from '@credo-ts/redis-cache', or set 'requestContextCache' to false in the OpenId4VcModule config."
      )
      hasWarnedAboutCache = true
    }
    return undefined
  }

  return { cache, expiryInSeconds: options.expiryInSeconds }
}

export async function getCachedValue<T>(
  agentContext: AgentContext,
  key: string,
  load: () => Promise<T | null>
): Promise<T | null> {
  const cache = getCache(agentContext)
  if (!cache) return load()

  const cached = await cache.cache.get<T>(agentContext, key)
  if (cached !== null && cached !== undefined) return cached

  const value = await load()
  // A missing value is not cached, so a record created later is found at once
  if (value !== null) await cache.cache.set(agentContext, key, value, cache.expiryInSeconds)

  return value
}

/**
 * Returns a copy of the record that must not be written back to storage: it can be older than the
 * stored record.
 */
export async function getCachedRecord<R extends BaseRecord>(
  agentContext: AgentContext,
  key: string,
  // biome-ignore lint/suspicious/noExplicitAny: matches the class type the JsonTransformer accepts
  recordClass: new (...args: any[]) => R,
  load: () => Promise<R>
): Promise<R> {
  let loaded: R | undefined
  const json = await getCachedValue(agentContext, key, async () => {
    loaded = await load()
    return loaded.toJSON()
  })

  return loaded ?? JsonTransformer.fromJSON(json, recordClass)
}

// Does not throw, as the change to the record is already stored when this is called
export async function removeCachedValue(agentContext: AgentContext, key: string) {
  const cache = getCache(agentContext)
  if (!cache) return

  try {
    await cache.cache.remove(agentContext, key)
  } catch (error) {
    agentContext.config.logger.error(
      `Error removing '${key}' from the cache. The outdated record can be used until it expires after ${cache.expiryInSeconds} seconds.`,
      { error }
    )
  }
}
