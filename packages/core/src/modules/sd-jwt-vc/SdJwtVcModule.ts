import type { DependencyManager, Module } from '../../plugins'

import { AgentConfig } from '../../agent/AgentConfig'

import { SdJwtVcApi } from './SdJwtVcApi'
import { SdJwtVcModuleConfig, SdJwtVcModuleConfigOptions } from './SdJwtVcModuleConfig'
import { SdJwtVcService } from './SdJwtVcService'
import { TokenStatusListService } from './credential-status'
import { SdJwtVcRepository } from './repository'

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

    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The 'SdJwtVc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    dependencyManager.registerSingleton(TokenStatusListService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
