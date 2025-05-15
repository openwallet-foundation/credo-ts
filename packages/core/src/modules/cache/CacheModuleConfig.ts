import type { Cache } from './Cache'

/**
 * CacheModuleConfigOptions defines the interface for the options of the CacheModuleConfig class.
 */
export interface CacheModuleConfigOptions {
  /**
   *
   * Implementation of the {@link Cache} interface.
   *
   */
  cache: Cache

  /**
   *
   * @default 60
   *
   */
  defaultExpiryInSeconds?: number

  /**
   *
   * Uses a caching registry before talking to the storage service when a Record has the `useCache` set to `true`
   *
   * @default false
   *
   */
  useCachedStorageService?: boolean
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

  /** See {@link CacheModuleConfigOptions.defaultExpiryInSeconds} */
  public get defaultExpiryInSeconds() {
    return this.options.defaultExpiryInSeconds ?? 60
  }

  /** See {@link CacheModuleConfigOptions.useCachedStorageService} */
  public get useCachedStorageService() {
    return this.options.useCachedStorageService ?? false
  }
}
