import type { DependencyManager, Module } from '../../plugins'

import { AgentConfig } from '../../agent/AgentConfig'

import { DifPresentationExchangeService } from './DifPresentationExchangeService'

/**
 * @public
 */
export class DifPresentationExchangeModule implements Module {
  /**
   * Registers the dependencies of the presentation-exchange module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The 'DifPresentationExchangeModule' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // service
    dependencyManager.registerSingleton(DifPresentationExchangeService)
  }
}
