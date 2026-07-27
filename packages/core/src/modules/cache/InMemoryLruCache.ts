import LRUMap from 'lru_map'
import type { AgentContext } from '../../agent/context'
import type { Cache, CacheOptions } from './Cache'

export interface InMemoryLruCacheOptions {
  /** The maximum number of entries allowed in the cache */
  limit: number
}

/**
 * In memory LRU cache.
 *
 * This cache can be used with multiple agent context instances. Keys are namespaced by the
 * `contextCorrelationId` of the agent context by default, and by `global:` for entries using the
 * `'global'` scope. Note that separate root agent instances sharing this cache also share the
 * `default` context namespace.
 *
 * The `limit` applies to the cache as a whole, spanning all contexts and the global scope, so a
 * busy context can evict entries of other contexts. `clear()` also clears all scopes and contexts.
 */
export class InMemoryLruCache implements Cache {
  private readonly cache: LRUMap.LRUMap<string, CacheItem>

  public constructor({ limit }: InMemoryLruCacheOptions) {
    this.cache = new LRUMap.LRUMap<string, CacheItem>(limit)
  }

  private getNamespacedKey(agentContext: AgentContext, key: string, options?: CacheOptions) {
    if (options?.scope === 'global') {
      return `global:${key}`
    }

    return `${agentContext.contextCorrelationId}:${key}`
  }

  public async get<CacheValue>(agentContext: AgentContext, key: string, options?: CacheOptions) {
    this.removeExpiredItems()
    key = this.getNamespacedKey(agentContext, key, options)
    const item = this.cache.get(key)

    // Does not exist
    if (!item) return null

    return item.value as CacheValue
  }

  public async set<CacheValue>(
    agentContext: AgentContext,
    key: string,
    value: CacheValue,
    expiresInSeconds?: number,
    options?: CacheOptions
  ): Promise<void> {
    this.removeExpiredItems()
    let expiresDate: Date | undefined

    if (expiresInSeconds) {
      expiresDate = new Date()
      expiresDate.setSeconds(expiresDate.getSeconds() + expiresInSeconds)
    }

    key = this.getNamespacedKey(agentContext, key, options)
    this.cache.set(key, {
      expiresAt: expiresDate?.getTime(),
      value,
    })
  }

  public clear() {
    this.cache.clear()
  }

  public async remove(agentContext: AgentContext, key: string, options?: CacheOptions): Promise<void> {
    this.removeExpiredItems()
    key = this.getNamespacedKey(agentContext, key, options)
    this.cache.delete(key)
  }

  private removeExpiredItems() {
    this.cache.forEach((value, key) => {
      if (value.expiresAt && Date.now() > value.expiresAt) {
        this.cache.delete(key)
      }
    })
  }
}

interface CacheItem {
  expiresAt?: number
  value: unknown
}
