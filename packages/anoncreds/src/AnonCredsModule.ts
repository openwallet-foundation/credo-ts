import type { AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'

/**
 * @public
 */
export class AnonCredsModule implements Module {
  public readonly config: AnonCredsModuleConfig

  public constructor(config: AnonCredsModuleConfigOptions) {
    this.config = new AnonCredsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(AnonCredsModuleConfig, this.config)

    dependencyManager.registerSingleton(AnonCredsRegistryService)
  }
}
