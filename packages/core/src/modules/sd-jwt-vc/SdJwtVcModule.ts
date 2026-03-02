import type { DependencyManager, Module } from '../../plugins'
import { SdJwtVcRepository } from './repository'
import { SdJwtVcApi } from './SdJwtVcApi'
import { SdJwtVcModuleConfig, type SdJwtVcModuleConfigOptions } from './SdJwtVcModuleConfig'
import { SdJwtVcService } from './SdJwtVcService'

/**
 * @public
 */
export class SdJwtVcModule implements Module {
  public readonly config: SdJwtVcModuleConfig

  public readonly api = SdJwtVcApi

  public constructor(options?: SdJwtVcModuleConfigOptions) {
    this.config = new SdJwtVcModuleConfig(options)
  }

  /**
   * Registers the dependencies of the sd-jwt-vc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(SdJwtVcModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
