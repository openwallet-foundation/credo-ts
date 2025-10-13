import { AgentConfig } from '../../agent/AgentConfig'
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
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The 'SdJwtVc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
