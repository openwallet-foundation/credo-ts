import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { SdJwtApi } from './SdJwtApi'
import { SdJwtService } from './SdJwtService'
import { SdJwtRepository } from './repository'

/**
 * @public
 */
export class SdJwtModule implements Module {
  public readonly api = SdJwtApi

  /**
   * Registers the dependencies of the sd-jwt module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/sd-jwt' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Api
    dependencyManager.registerContextScoped(this.api)

    // Services
    dependencyManager.registerSingleton(SdJwtService)

    // Repositories
    dependencyManager.registerSingleton(SdJwtRepository)
  }
}
