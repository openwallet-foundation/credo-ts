import type { AnonCredsRsModuleConfigOptions } from './AnonCredsRsConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { registerAnoncreds } from 'anoncreds-shared'

import { AnonCredsRsModuleConfig } from './AnonCredsRsConfig'
import { AnonCredsRsSymbol } from './types'

export class AnonCredsRsModule implements Module {
  public readonly config: AnonCredsRsModuleConfig

  public constructor(config: AnonCredsRsModuleConfigOptions) {
    this.config = new AnonCredsRsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    registerAnoncreds({ lib: this.config.lib })

    dependencyManager.registerInstance(AnonCredsRsSymbol, this.config.lib)
  }
}
