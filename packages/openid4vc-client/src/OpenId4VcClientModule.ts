import type { DependencyManager, Module } from '@aries-framework/core'

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
    // Api
    dependencyManager.registerContextScoped(OpenId4VcClientApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcClientService)
  }
}
