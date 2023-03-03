import type { AskarModuleConfigOptions } from './AskarModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { AskarModuleConfig } from './AskarModuleConfig'
import { AskarStorageService } from './storage'

export class AskarModule implements Module {
  public readonly config: AskarModuleConfig

  public constructor(config: AskarModuleConfigOptions) {
    this.config = new AskarModuleConfig(config)
  }
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(AskarModuleConfig, this.config)

    dependencyManager.registerSingleton(AskarStorageService)
  }
}
