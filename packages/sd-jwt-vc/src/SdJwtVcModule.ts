import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { SdJwtVcApi } from './SdJwtVcApi'
import { SdJwtVcService } from './SdJwtVcService'
import { SdJwtVcRepository } from './repository'

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
        "The '@aries-framework/sd-jwt-vc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
