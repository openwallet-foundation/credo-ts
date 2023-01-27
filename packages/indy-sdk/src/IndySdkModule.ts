import type { IndySdkModuleConfigOptions } from './IndySdkModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { IndySdkModuleConfig } from './IndySdkModuleConfig'
import { IndySdkSymbol } from './types'

export class IndySdkModule implements Module {
  public readonly config: IndySdkModuleConfig

  public constructor(config: IndySdkModuleConfigOptions) {
    this.config = new IndySdkModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(IndySdkSymbol, this.config.indySdk)
  }
}
