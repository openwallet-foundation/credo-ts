import type { DependencyManager, Module } from '@credo-ts/core'

import { AgentConfig } from '@credo-ts/core'

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
        "The '@credo-ts/sd-jwt-vc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Api
    dependencyManager.registerContextScoped(this.api)

    // Services
    dependencyManager.registerSingleton(SdJwtVcService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtVcRepository)
  }
}
