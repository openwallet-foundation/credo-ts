import type { IndyVdrModuleConfigOptions } from './IndyVdrModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { IndyVdrModuleConfig } from './IndyVdrModuleConfig'
import { IndyVdrPoolService } from './pool/IndyVdrPoolService'

/**
 * @public
 * */
export class IndyVdrModule implements Module {
  public readonly config: IndyVdrModuleConfig

  public constructor(config: IndyVdrModuleConfigOptions) {
    this.config = new IndyVdrModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      require('@hyperledger/indy-vdr-nodejs')
    } catch (error) {
      try {
        require('@hyperledger/indy-vdr-react-native')
      } catch (error) {
        throw new Error('Error registering bindings for Indy VDR')
      }
    }

    // Config
    dependencyManager.registerInstance(IndyVdrModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(IndyVdrPoolService)
  }
}
