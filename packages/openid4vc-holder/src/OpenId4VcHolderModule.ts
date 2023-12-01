import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'
import { OpenId4VciHolderService } from '@aries-framework/openid4vc-issuer'
import { OpenId4VpHolderService, PresentationExchangeService } from '@aries-framework/openid4vc-verifier'

import { OpenId4VcHolderApi } from './OpenId4VcHolderApi'

/**
 * @public @module OpenId4VcHolderModule
 * This module provides the functionality to assume the role of owner in relation to the OpenId4VC specification suite.
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
        "The '@aries-framework/openid4vc-holder' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages. Multi-Tenancy is not supported."
      )

    // Api
    dependencyManager.registerContextScoped(OpenId4VcHolderApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VciHolderService)
    dependencyManager.registerSingleton(OpenId4VpHolderService)
    dependencyManager.registerSingleton(PresentationExchangeService)
  }
}
