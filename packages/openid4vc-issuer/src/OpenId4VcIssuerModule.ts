import type { OpenId4VcIssuerModuleConfigOptions } from './OpenId4VcIssuerModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { OpenId4VcIssuerApi } from './OpenId4VcIssuerApi'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'

/**
 * @public
 */
export class OpenId4VcIssuerModule implements Module {
  public readonly api = OpenId4VcIssuerApi
  public readonly config: OpenId4VcIssuerModuleConfig

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.config = new OpenId4VcIssuerModuleConfig(options)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/openid4vc-issuer' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Register config
    dependencyManager.registerInstance(OpenId4VcIssuerModuleConfig, this.config)

    // Api
    dependencyManager.registerContextScoped(OpenId4VcIssuerApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcIssuerService)
  }
}
