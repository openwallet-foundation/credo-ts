import type { DependencyManager, Module } from '../../plugins'
import { KeyManagementApi } from './KeyManagementApi'
import type { KeyManagementModuleConfigOptions } from './KeyManagementModuleConfig'
import { KeyManagementModuleConfig } from './KeyManagementModuleConfig'

export class KeyManagementModule implements Module {
  public readonly api = KeyManagementApi
  public readonly config: KeyManagementModuleConfig

  public constructor(config: KeyManagementModuleConfigOptions) {
    this.config = new KeyManagementModuleConfig(config)
  }

  /**
   * Registers the dependencies of the key management module.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(KeyManagementModuleConfig, this.config)
  }
}
