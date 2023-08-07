import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { OpenId4VcClientApi } from './OpenId4VcClientApi'
import { OpenId4VcClientService } from './OpenId4VcClientService'

/**
 * @public
 */
export class OpenId4VcClientModule implements Module {
  public readonly api = OpenId4VcClientApi

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/openid4vc-client' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Api
    dependencyManager.registerContextScoped(OpenId4VcClientApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcClientService)
  }
}
