import type { AgentContext } from '../../../agent/context'
import type { Cache } from '../Cache'
import type { SingleContextLruCacheItem } from './SingleContextLruCacheRecord'

import { LRUMap } from 'lru_map'

import { CredoError, RecordDuplicateError } from '../../../error'

import { SingleContextLruCacheRecord } from './SingleContextLruCacheRecord'
import { SingleContextLruCacheRepository } from './SingleContextLruCacheRepository'

const CONTEXT_STORAGE_LRU_CACHE_ID = 'CONTEXT_STORAGE_LRU_CACHE_ID'

export interface SingleContextStorageLruCacheOptions {
  /** The maximum number of entries allowed in the cache */
  limit: number
}

/**
 * Cache that leverages the storage associated with the agent context to store cache records.
 * It will keep an in-memory cache of the records to avoid hitting the storage on every read request.
 * Therefor this cache is meant to be used with a single instance of the agent.
 *
 * Due to keeping an in-memory copy of the cache, it is also not meant to be used with multiple
 * agent context instances (meaning multi-tenancy), as they will overwrite the in-memory cache.
 *
 * However, this means the cache is not meant for usage with multiple instances.
 */
export class SingleContextStorageLruCache implements Cache {
  private limit: number
  private _cache?: LRUMap<string, SingleContextLruCacheItem>
  private _contextCorrelationId?: string

  public constructor({ limit }: SingleContextStorageLruCacheOptions) {
    this.limit = limit
  }

  public async get<CacheValue>(agentContext: AgentContext, key: string) {
    this.assertContextCorrelationId(agentContext)

    const cache = await this.getCache(agentContext)
    this.removeExpiredItems(cache)

    const item = cache.get(key)

    // Does not exist
    if (!item) return null

    // Expired
    if (item.expiresAt && Date.now() > item.expiresAt) {
      cache.delete(key)
      await this.persistCache(agentContext)
      return null
    }

    return item.value as CacheValue
  }

  public async set<CacheValue>(
    agentContext: AgentContext,
    key: string,
    value: CacheValue,
    expiresInSeconds?: number
  ): Promise<void> {
    this.assertContextCorrelationId(agentContext)

    let expiresDate = undefined

    if (expiresInSeconds) {
      expiresDate = new Date()
      expiresDate.setSeconds(expiresDate.getSeconds() + expiresInSeconds)
    }

    const cache = await this.getCache(agentContext)
    this.removeExpiredItems(cache)

    cache.set(key, {
      expiresAt: expiresDate?.getTime(),
      value,
    })
    await this.persistCache(agentContext)
  }

  public async remove(agentContext: AgentContext, key: string): Promise<void> {
    this.assertContextCorrelationId(agentContext)

    const cache = await this.getCache(agentContext)
    this.removeExpiredItems(cache)
    cache.delete(key)

    await this.persistCache(agentContext)
  }

  private async getCache(agentContext: AgentContext) {
    if (!this._cache) {
      const cacheRecord = await this.fetchCacheRecord(agentContext)
      this._cache = this.lruFromRecord(cacheRecord)
    }

    return this._cache
  }

  private lruFromRecord(cacheRecord: SingleContextLruCacheRecord) {
    return new LRUMap<string, SingleContextLruCacheItem>(this.limit, cacheRecord.entries.entries())
  }

  private async fetchCacheRecord(agentContext: AgentContext) {
    const cacheRepository = agentContext.dependencyManager.resolve(SingleContextLruCacheRepository)
    let cacheRecord = await cacheRepository.findById(agentContext, CONTEXT_STORAGE_LRU_CACHE_ID)

    if (!cacheRecord) {
      cacheRecord = new SingleContextLruCacheRecord({
        id: CONTEXT_STORAGE_LRU_CACHE_ID,
        entries: new Map(),
      })

      try {
        await cacheRepository.save(agentContext, cacheRecord)
      } catch (error) {
        // This addresses some race conditions issues where we first check if the record exists
        // then we create one if it doesn't, but another process has created one in the meantime
        // Although not the most elegant solution, it addresses the issues
        if (error instanceof RecordDuplicateError) {
          // the record already exists, which is our intended end state
          // we can ignore this error and fetch the existing record
          return cacheRepository.getById(agentContext, CONTEXT_STORAGE_LRU_CACHE_ID)
        }
        throw error
      }
    }

    return cacheRecord
  }

  private removeExpiredItems(cache: LRUMap<string, SingleContextLruCacheItem>) {
    cache.forEach((value, key) => {
      if (value.expiresAt && Date.now() > value.expiresAt) {
        cache.delete(key)
      }
    })
  }

  private async persistCache(agentContext: AgentContext) {
    const cacheRepository = agentContext.dependencyManager.resolve(SingleContextLruCacheRepository)
    const cache = await this.getCache(agentContext)

    await cacheRepository.update(
      agentContext,
      new SingleContextLruCacheRecord({
        entries: new Map(cache.toJSON().map(({ key, value }) => [key, value])),
        id: CONTEXT_STORAGE_LRU_CACHE_ID,
      })
    )
  }

  /**
   * Asserts this class is not used with multiple agent context instances.
   */
  private assertContextCorrelationId(agentContext: AgentContext) {
    if (!this._contextCorrelationId) {
      this._contextCorrelationId = agentContext.contextCorrelationId
    }

    if (this._contextCorrelationId !== agentContext.contextCorrelationId) {
      throw new CredoError(
        'SingleContextStorageLruCache can not be used with multiple agent context instances. Register a custom cache implementation in the CacheModule.'
      )
    }
  }
}
