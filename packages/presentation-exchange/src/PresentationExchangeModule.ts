import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { PresentationExchangeService } from './PresentationExchangeService'

/**
 * @public
 */
export class PresentationExchangeModule implements Module {
  /**
   * Registers the dependencies of the presentation-exchange module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/presentation-exchange' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Services
    dependencyManager.registerSingleton(PresentationExchangeService)
  }
}
