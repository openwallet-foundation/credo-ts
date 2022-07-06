import type { AgentContext } from '../agent'
import type { CacheRepository } from './CacheRepository'

import { LRUMap } from 'lru_map'

import { CacheRecord } from './CacheRecord'

export class PersistedLruCache<CacheValue> {
  private cacheId: string
  private limit: number
  private _cache?: LRUMap<string, CacheValue>
  private cacheRepository: CacheRepository

  public constructor(cacheId: string, limit: number, cacheRepository: CacheRepository) {
    this.cacheId = cacheId
    this.limit = limit
    this.cacheRepository = cacheRepository
  }

  public async get(agentContext: AgentContext, key: string) {
    const cache = await this.getCache(agentContext)

    return cache.get(key)
  }

  public async set(agentContext: AgentContext, key: string, value: CacheValue) {
    const cache = await this.getCache(agentContext)

    cache.set(key, value)
    await this.persistCache(agentContext)
  }

  private async getCache(agentContext: AgentContext) {
    if (!this._cache) {
      const cacheRecord = await this.fetchCacheRecord(agentContext)
      this._cache = this.lruFromRecord(cacheRecord)
    }

    return this._cache
  }

  private lruFromRecord(cacheRecord: CacheRecord) {
    return new LRUMap<string, CacheValue>(
      this.limit,
      cacheRecord.entries.map((e) => [e.key, e.value as CacheValue])
    )
  }

  private async fetchCacheRecord(agentContext: AgentContext) {
    let cacheRecord = await this.cacheRepository.findById(agentContext, this.cacheId)

    if (!cacheRecord) {
      cacheRecord = new CacheRecord({
        id: this.cacheId,
        entries: [],
      })

      await this.cacheRepository.save(agentContext, cacheRecord)
    }

    return cacheRecord
  }

  private async persistCache(agentContext: AgentContext) {
    const cache = await this.getCache(agentContext)

    await this.cacheRepository.update(
      agentContext,
      new CacheRecord({
        entries: cache.toJSON(),
        id: this.cacheId,
      })
    )
  }
}
