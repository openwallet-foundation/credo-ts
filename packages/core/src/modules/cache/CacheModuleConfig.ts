import type { Cache } from './Cache'

/**
 * CacheModuleConfigOptions defines the interface for the options of the CacheModuleConfig class.
 */
export interface CacheModuleConfigOptions {
  /**
   * Implementation of the {@link Cache} interface.
   *
   * NOTE: Starting from AFJ 0.4.0 the default cache implementation will be {@link InMemoryLruCache}
   * @default SingleContextStorageLruCache - with a limit of 500
   *
   *
   */
  cache: Cache
}

export class CacheModuleConfig {
  private options: CacheModuleConfigOptions

  public constructor(options: CacheModuleConfigOptions) {
    this.options = options
  }

  /** See {@link CacheModuleConfigOptions.cache} */
  public get cache() {
    return this.options.cache
  }
}
