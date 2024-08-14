import type { Module, DependencyManager } from '../../plugins'

import { AgentConfig } from '../../agent/AgentConfig'

import { MdocApi } from './MdocApi'
import { MdocService } from './MdocService'
import { MdocRepository } from './repository'

/**
 * @public
 */
export class MdocModule implements Module {
  public readonly api = MdocApi

  /**
   * Registers the dependencies of the mdoc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The 'Mdoc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Services
    dependencyManager.registerSingleton(MdocService)

    // Repositories
    dependencyManager.registerSingleton(MdocRepository)
  }
}
