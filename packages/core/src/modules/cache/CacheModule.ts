import type { CacheModuleConfigOptions } from './CacheModuleConfig'
import type { Optional } from '../../utils'
import type { DependencyManager, Module } from '@aries-framework/core'

import { CacheModuleConfig } from './CacheModuleConfig'
import { CacheRepository } from './singleContextLruCache/CacheRepository'
import { SingleContextStorageLruCache } from './singleContextLruCache/SingleContextStorageLruCache'

// CacheModuleOptions makes the credentialProtocols property optional from the config, as it will set it when not provided.
export type CacheModuleOptions = Optional<CacheModuleConfigOptions, 'cache'>

export class CacheModule implements Module {
  public readonly config: CacheModuleConfig

  public constructor(config?: CacheModuleOptions) {
    this.config = new CacheModuleConfig({
      ...config,
      cache:
        config?.cache ??
        new SingleContextStorageLruCache({
          limit: 500,
        }),
    })
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(CacheModuleConfig, this.config)

    // Custom handling for when we're using the SingleContextStorageLruCache
    if (this.config.cache instanceof SingleContextStorageLruCache) {
      dependencyManager.registerSingleton(CacheRepository)
    }
  }
}
