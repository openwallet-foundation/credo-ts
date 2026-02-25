import type { DependencyManager, Module } from '../../plugins'
import { CachedStorageService } from './CachedStorageService'
import type { CacheModuleConfigOptions } from './CacheModuleConfig'

import { CacheModuleConfig } from './CacheModuleConfig'
import { SingleContextLruCacheRepository } from './singleContextLruCache/SingleContextLruCacheRepository'
import { SingleContextStorageLruCache } from './singleContextLruCache/SingleContextStorageLruCache'

export type CacheModuleOptions = CacheModuleConfigOptions

export class CacheModule implements Module {
  public readonly config: CacheModuleConfig

  public constructor(config: CacheModuleOptions) {
    this.config = new CacheModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(CacheModuleConfig, this.config)

    // Allows us to use the `CachedStorageService` instead of the `StorageService`
    // This first checks the local cache to return a record
    if (this.config.useCachedStorageService) {
      dependencyManager.registerSingleton(CachedStorageService)
    }

    // Custom handling for when we're using the SingleContextStorageLruCache
    if (this.config.cache instanceof SingleContextStorageLruCache) {
      dependencyManager.registerSingleton(SingleContextLruCacheRepository)
    }
  }
}
