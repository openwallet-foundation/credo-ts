import type { DependencyManager } from '@credo-ts/core'

import { OpenId4VcHolderApi } from './OpenId4VcHolderApi'
import { OpenId4VcHolderModuleConfig, type OpenId4VcHolderModuleConfigOptions } from './OpenId4VcHolderModuleConfig'
import { OpenId4VciHolderService } from './OpenId4VciHolderService'
import { OpenId4VpHolderService } from './OpenId4vpHolderService'

/**
 * @public @module OpenId4VcHolderModule
 * This module provides the functionality to assume the role of owner in relation to the OpenId4VC specification suite.
 */
export class OpenId4VcHolderModule {
  public readonly config: OpenId4VcHolderModuleConfig

  public constructor(options?: OpenId4VcHolderModuleConfigOptions | OpenId4VcHolderModuleConfig) {
    this.config = options instanceof OpenId4VcHolderModuleConfig ? options : new OpenId4VcHolderModuleConfig(options)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Since the OpenID4VC module is a nested module (a module consisting of three modules) we register the API
    // manually. In the future we may disallow resolving the sub-api, but for now it allows for a cleaner migration path
    dependencyManager.registerContextScoped(OpenId4VcHolderApi)

    // Register config
    dependencyManager.registerInstance(OpenId4VcHolderModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(OpenId4VciHolderService)
    dependencyManager.registerSingleton(OpenId4VpHolderService)
  }
}
