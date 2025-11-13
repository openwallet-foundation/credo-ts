import type { DependencyManager, Module } from '../../plugins'

import { MdocApi } from './MdocApi'
import { MdocService } from './MdocService'
import { MdocRepository } from './repository'

/**
 * @public
 */
export class MdocModule implements Module {
  public readonly api = MdocApi

  /**
   * Registers the dependencies of the mdoc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(MdocService)

    // Repositories
    dependencyManager.registerSingleton(MdocRepository)
  }
}
