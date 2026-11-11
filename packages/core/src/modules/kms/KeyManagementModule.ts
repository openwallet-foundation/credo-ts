import type { DependencyManager, Module } from '../../plugins'
import type { Constructor } from '../../utils/mixins'
import { KeyManagementApi } from './KeyManagementApi'
import type { KeyManagementModuleConfigOptions } from './KeyManagementModuleConfig'
import { KeyManagementModuleConfig } from './KeyManagementModuleConfig'
import type { KeyManagementService } from './KeyManagementService'

export class KeyManagementModule<Backends extends KeyManagementService[] = KeyManagementService[]> implements Module {
  // Infer the api type from the backends, which types `agent.kms`
  public readonly api: Constructor<KeyManagementApi<Backends>> = KeyManagementApi
  public readonly config: KeyManagementModuleConfig

  public constructor(config: KeyManagementModuleConfigOptions<Backends>) {
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
