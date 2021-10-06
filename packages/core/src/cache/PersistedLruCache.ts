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

  public async get(key: string) {
    const cache = await this.getCache()

    return cache.get(key)
  }

  public async set(key: string, value: CacheValue) {
    const cache = await this.getCache()

    cache.set(key, value)
    await this.persistCache()
  }

  private async getCache() {
    if (!this._cache) {
      const cacheRecord = await this.fetchCacheRecord()
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

  private async fetchCacheRecord() {
    let cacheRecord = await this.cacheRepository.findById(this.cacheId)

    if (!cacheRecord) {
      cacheRecord = new CacheRecord({
        id: this.cacheId,
        entries: [],
      })

      await this.cacheRepository.save(cacheRecord)
    }

    return cacheRecord
  }

  private async persistCache() {
    const cache = await this.getCache()

    await this.cacheRepository.save(
      new CacheRecord({
        entries: cache.toJSON(),
        id: this.cacheId,
      })
    )
  }
}
