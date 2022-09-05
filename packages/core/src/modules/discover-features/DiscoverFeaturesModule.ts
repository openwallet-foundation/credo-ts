import type { DependencyManager, Module } from '../../plugins'
import type { DiscoverFeaturesModuleConfigOptions } from './DiscoverFeaturesModuleConfig'
import type { FeatureRegistry } from './FeatureRegistry'

import { DiscoverFeaturesApi } from './DiscoverFeaturesApi'
import { DiscoverFeaturesModuleConfig } from './DiscoverFeaturesModuleConfig'
import { Protocol } from './models'
import { V1DiscoverFeaturesService } from './protocol/v1'
import { V2DiscoverFeaturesService } from './protocol/v2'

export class DiscoverFeaturesModule implements Module {
  public readonly config: DiscoverFeaturesModuleConfig

  public constructor(config?: DiscoverFeaturesModuleConfigOptions) {
    this.config = new DiscoverFeaturesModuleConfig(config)
  }

  /**
   * Registers the dependencies of the discover features module on the dependency manager.
   */
  public register(featureRegistry: FeatureRegistry, dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DiscoverFeaturesApi)

    // Config
    dependencyManager.registerInstance(DiscoverFeaturesModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(V1DiscoverFeaturesService)
    dependencyManager.registerSingleton(V2DiscoverFeaturesService)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/discover-features/1.0',
        roles: ['requester', 'responder'],
      }),
      new Protocol({
        id: 'https://didcomm.org/discover-features/2.0',
        roles: ['requester', 'responder'],
      })
    )
  }
}
