import { LRUCache } from 'lru-cache'
import { CredoError } from '../../error'

export interface LruCacheOptions {
  /** The maximum number of entries allowed in the cache. With 0 nothing is kept. */
  limit: number
}

/**
 * In memory least recently used cache. All LRU caches in Credo go through this class, so the
 * underlying library is only used here.
 */
export class LruCache<Value extends {}> {
  // Not set when the limit is 0, as `lru-cache` has no limit of 0
  private readonly cache?: LRUCache<string, Value>

  public constructor({ limit }: LruCacheOptions) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new CredoError(`The limit of an LRU cache must be 0 or a positive integer, received '${limit}'`)
    }

    if (limit > 0) this.cache = new LRUCache({ max: limit })
  }

  public get(key: string): Value | undefined {
    return this.cache?.get(key)
  }

  public set(key: string, value: Value) {
    this.cache?.set(key, value)
  }

  public delete(key: string) {
    this.cache?.delete(key)
  }

  public clear() {
    this.cache?.clear()
  }

  /**
   * A snapshot of the entries from least to most recently used, so entries can be deleted while iterating.
   */
  public entries(): Array<[key: string, value: Value]> {
    // `rentries` is typed as an array of `key | value`
    return [...(this.cache?.rentries() ?? [])] as Array<[string, Value]>
  }
}
