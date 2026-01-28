import type { DependencyManager, Module } from '../../plugins'

import { DifPresentationExchangeService } from './DifPresentationExchangeService'

/**
 * @public
 */
export class DifPresentationExchangeModule implements Module {
  /**
   * Registers the dependencies of the presentation-exchange module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // service
    dependencyManager.registerSingleton(DifPresentationExchangeService)
  }
}
