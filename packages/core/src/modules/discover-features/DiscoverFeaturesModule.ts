import type { DependencyManager, Module } from '../../plugins'
import type { FeatureRegistry } from './FeatureRegistry'

import { DiscoverFeaturesApi } from './DiscoverFeaturesApi'
import { Protocol } from './models'
import { DiscoverFeaturesService } from './protocol/v1'
import { V2DiscoverFeaturesService } from './protocol/v2'

export class DiscoverFeaturesModule implements Module {
  /**
   * Registers the dependencies of the discover features module on the dependency manager.
   */
  public register(featureRegistry: FeatureRegistry, dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DiscoverFeaturesApi)

    // Services
    dependencyManager.registerSingleton(DiscoverFeaturesService)
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
