import type { AgentContext } from '../../agent/context'
import type { Cache } from './Cache'

import { LRUMap } from 'lru_map'

export interface InMemoryLruCacheOptions {
  /** The maximum number of entries allowed in the cache */
  limit: number
}

/**
 * In memory LRU cache.
 *
 * This cache can be used with multiple agent context instances, however all instances will share the same cache.
 * If you need the cache to be isolated per agent context instance, make sure to use a different cache implementation.
 */
export class InMemoryLruCache implements Cache {
  private readonly cache: LRUMap<string, CacheItem>

  public constructor({ limit }: InMemoryLruCacheOptions) {
    this.cache = new LRUMap<string, CacheItem>(limit)
  }

  public async get<CacheValue>(_agentContext: AgentContext, key: string) {
    this.removeExpiredItems()
    const item = this.cache.get(key)

    // Does not exist
    if (!item) return null

    return item.value as CacheValue
  }

  public async set<CacheValue>(
    _agentContext: AgentContext,
    key: string,
    value: CacheValue,
    expiresInSeconds?: number
  ): Promise<void> {
    this.removeExpiredItems()
    let expiresDate = undefined

    if (expiresInSeconds) {
      expiresDate = new Date()
      expiresDate.setSeconds(expiresDate.getSeconds() + expiresInSeconds)
    }

    this.cache.set(key, {
      expiresAt: expiresDate?.getTime(),
      value,
    })
  }

  public clear() {
    this.cache.clear()
  }

  public async remove(_agentContext: AgentContext, key: string): Promise<void> {
    this.removeExpiredItems()
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
