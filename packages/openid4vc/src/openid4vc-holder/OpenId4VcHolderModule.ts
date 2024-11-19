import type { DependencyManager, Module } from '@credo-ts/core'

import { setGlobalConfig } from '@animo-id/oauth2'
import { AgentConfig } from '@credo-ts/core'

import { OpenId4VcHolderApi } from './OpenId4VcHolderApi'
import { OpenId4VciHolderService } from './OpenId4VciHolderService'
import { OpenId4VcSiopHolderService } from './OpenId4vcSiopHolderService'

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
    const agentConfig = dependencyManager.resolve(AgentConfig)

    // Warn about experimental module
    agentConfig.logger.warn(
      "The '@credo-ts/openid4vc' Holder module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
    )

    if (agentConfig.allowInsecureHttpUrls) {
      setGlobalConfig({
        allowInsecureUrls: true,
      })
    }

    // Services
    dependencyManager.registerSingleton(OpenId4VciHolderService)
    dependencyManager.registerSingleton(OpenId4VcSiopHolderService)
  }
}
