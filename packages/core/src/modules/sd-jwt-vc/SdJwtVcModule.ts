import type { DependencyManager, Module } from '../../plugins'
import { SdJwtVcRepository } from './repository'
import { SdJwtVcApi } from './SdJwtVcApi'
import { SdJwtVcModuleConfig, SdJwtVcModuleConfigOptions } from './SdJwtVcModuleConfig'
import { SdJwtVcService } from './SdJwtVcService'
import { TokenStatusListService } from './credential-status'

/**
 * @public
 */
export class SdJwtVcModule implements Module {
  public readonly config: SdJwtVcModuleConfig

  public constructor(config?: SdJwtVcModuleConfigOptions) {
    this.config = new SdJwtVcModuleConfig(config)
  }

  public readonly api = SdJwtVcApi

  /**
   * Registers the dependencies of the sd-jwt-vc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(SdJwtVcModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    dependencyManager.registerSingleton(TokenStatusListService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
