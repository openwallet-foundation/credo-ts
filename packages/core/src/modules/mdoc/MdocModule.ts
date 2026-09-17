import type { DependencyManager, Module } from '../../plugins'
import { MdocApi } from './MdocApi'
import { MdocDcApiService } from './MdocDcApiService'
import { MdocService } from './MdocService'
import { MdocRepository, MdocVerificationSessionRepository } from './repository'

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
    dependencyManager.registerSingleton(MdocDcApiService)

    // Repositories
    dependencyManager.registerSingleton(MdocRepository)
    dependencyManager.registerSingleton(MdocVerificationSessionRepository)
  }
}
