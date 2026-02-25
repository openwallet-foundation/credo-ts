import type { DependencyManager, Module } from '../../plugins'
import { X509Api } from './X509Api'
import type { X509ModuleConfigOptions } from './X509ModuleConfig'
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
    // Register config
    dependencyManager.registerInstance(X509ModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(X509Service)
  }
}
