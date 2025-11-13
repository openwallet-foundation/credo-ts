import type { DependencyManager, Module } from '../../plugins'

import { DcqlService } from './DcqlService'

/**
 * @public
 */
export class DcqlModule implements Module {
  /**
   * Registers the dependencies of the dcql module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // service
    dependencyManager.registerSingleton(DcqlService)
  }
}
