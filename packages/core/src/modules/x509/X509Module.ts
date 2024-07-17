import type { X509ModuleConfigOptions } from './X509ModuleConfig'
import type { Module, DependencyManager } from '../../plugins'

import { AgentConfig } from '../../agent/AgentConfig'

import { X509Api } from './X509Api'
import { X509ModuleConfig } from './X509ModuleConfig'
import { X509Service } from './X509Service'

/**
 * @public
 */
export class X509Module implements Module {
  public readonly api = X509Api

  public readonly config: X509ModuleConfig

  public constructor(options?: X509ModuleConfigOptions) {
    this.config = new X509ModuleConfig(options)
  }

  /**
   * Registers the dependencies of the sd-jwt-vc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The 'X509' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Register config
    dependencyManager.registerInstance(X509ModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(X509Service)
  }
}
