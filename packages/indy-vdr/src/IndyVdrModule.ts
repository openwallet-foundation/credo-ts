import type { IndyVdrModuleConfigOptions } from './IndyVdrModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import { IndyVdrApi } from './IndyVdrApi'
import { IndyVdrModuleConfig } from './IndyVdrModuleConfig'
import { IndyVdrPoolService } from './pool/IndyVdrPoolService'

/**
 * @public
 * */
export class IndyVdrModule implements Module {
  public readonly config: IndyVdrModuleConfig
  public readonly api = IndyVdrApi

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

    // Api
    dependencyManager.registerContextScoped(IndyVdrApi)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

    for (const pool of indyVdrPoolService.pools) {
      if (pool.config.connectOnStartup) {
        await pool.connect()
      }
    }
  }
}
