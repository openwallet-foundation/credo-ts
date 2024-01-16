import type { OpenId4VcVerifierModuleConfigOptions } from './OpenId4VcVerifierModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { OpenId4VcVerifierApi } from './OpenId4VcVerifierApi'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierService } from './OpenId4VcVerifierService'

/**
 * @public
 */
export class OpenId4VcVerifierModule implements Module {
  public readonly api = OpenId4VcVerifierApi

  public readonly config: OpenId4VcVerifierModuleConfig

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.config = new OpenId4VcVerifierModuleConfig(options)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    const logger = dependencyManager.resolve(AgentConfig).logger
    logger.warn(
      "The '@aries-framework/openid4vc' Verifier module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
    )

    // Register config
    dependencyManager.registerInstance(OpenId4VcVerifierModuleConfig, this.config)

    // Api
    dependencyManager.registerContextScoped(OpenId4VcVerifierApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcVerifierService)
  }
}
