import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { OpenId4VcHolderApi } from './OpenId4VcHolderApi'
import { OpenId4VcHolderService } from './OpenId4VcHolderService'
import { PresentationExchangeService } from './presentations'
import { OpenId4VpHolderService } from './presentations/OpenId4VpHolderService'

/**
 * @public
 */
export class OpenId4VcHolderModule implements Module {
  public readonly api = OpenId4VcHolderApi

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/openid4vc-holder' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Api
    dependencyManager.registerContextScoped(OpenId4VcHolderApi)

    // Services
    // Services
    dependencyManager.registerSingleton(OpenId4VcHolderService)
    dependencyManager.registerSingleton(OpenId4VpHolderService)
    dependencyManager.registerSingleton(PresentationExchangeService)
  }
}
