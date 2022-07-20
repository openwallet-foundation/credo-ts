import type { DependencyManager, Module } from '../../plugins'

import { DiscoverFeaturesApi } from './DiscoverFeaturesApi'
import { DiscoverFeaturesService } from './services'

export class DiscoverFeaturesModule implements Module {
  public readonly api = DiscoverFeaturesApi

  /**
   * Registers the dependencies of the discover features module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DiscoverFeaturesApi)

    // Services
    dependencyManager.registerSingleton(DiscoverFeaturesService)
  }
}
