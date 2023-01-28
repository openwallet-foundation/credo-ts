import type { AnonCredsRsModuleConfigOptions } from './AnonCredsRsConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { AnonCredsRsModuleConfig } from './AnonCredsRsConfig'
import { AnonCredsRsSymbol } from './types'

export class AnonCredsRsModule implements Module {
  public readonly config: AnonCredsRsModuleConfig

  public constructor(config: AnonCredsRsModuleConfigOptions) {
    this.config = new AnonCredsRsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      require('@hyperledger/anoncreds-nodejs')
    } catch (error) {
      try {
        require('@hyperledger/anoncreds-react-native')
      } catch (error) {
        throw new Error('Could not load anoncreds bindings')
      }
    }

    dependencyManager.registerInstance(AnonCredsRsSymbol, this.config.lib)
  }
}
