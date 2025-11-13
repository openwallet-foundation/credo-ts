import type { DependencyManager, Module } from '../../plugins'
import { SdJwtVcRepository } from './repository'
import { SdJwtVcApi } from './SdJwtVcApi'
import { SdJwtVcService } from './SdJwtVcService'

/**
 * @public
 */
export class SdJwtVcModule implements Module {
  public readonly api = SdJwtVcApi

  /**
   * Registers the dependencies of the sd-jwt-vc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
