import type { DependencyManager, Module } from '@credo-ts/core'

import { AgentConfig } from '@credo-ts/core'

import { OpenId4VcClientApi } from './OpenId4VcClientApi'
import { OpenId4VcClientService } from './OpenId4VcClientService'

/**
 * @public
 */
export class OpenId4VcClientModule implements Module {
  public readonly api = OpenId4VcClientApi

  /**
   * Registers the dependencies of the openid4vc-client module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@credo-ts/openid4vc-client' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Api
    dependencyManager.registerContextScoped(OpenId4VcClientApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcClientService)
  }
}
