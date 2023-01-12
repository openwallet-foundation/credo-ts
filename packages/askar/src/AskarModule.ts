import type { AskarModuleConfigOptions } from './AskarModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { registerAriesAskar } from 'aries-askar-shared'

import { AskarModuleConfig } from './AskarModuleConfig'
import { AskarSymbol } from './types'

export class AskarModule implements Module {
  public readonly config: AskarModuleConfig

  public constructor(config: AskarModuleConfigOptions) {
    this.config = new AskarModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    registerAriesAskar({ askar: this.config.askar })

    dependencyManager.registerInstance(AskarSymbol, this.config.askar)
  }
}
