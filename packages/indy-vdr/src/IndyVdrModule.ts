import type { IndyVdrModuleConfigOptions } from './IndyVdrModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

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
    // Config
    dependencyManager.registerInstance(IndyVdrModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(IndyVdrPoolService)
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
