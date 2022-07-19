import type { DependencyManager, Module } from '../../plugins'

import { DidsApi } from './DidsApi'
import { DidRepository } from './repository'
import { DidResolverService } from './services'

export class DidsModule implements Module {
  /**
   * Registers the dependencies of the dids module module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DidsApi)

    // Services
    dependencyManager.registerSingleton(DidResolverService)
    dependencyManager.registerSingleton(DidRepository)
  }
}
