import type { DependencyManager, Module } from '@aries-framework/core'

import { W3cCredentialService } from '@aries-framework/core'

import { OidcClientApi } from './OidcClientApi'
import { OidcClientService } from './OidcClientService'

/**
 * @public
 */
export class OidcClientModule implements Module {
  public readonly api = OidcClientApi

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(OidcClientApi)

    // Services
    dependencyManager.registerSingleton(OidcClientService)
  }
}
