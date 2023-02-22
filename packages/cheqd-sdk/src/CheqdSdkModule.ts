import type { CheqdSdkModuleConfigOptions } from './CheqdSdkModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import { CheqdSdkModuleConfig } from './CheqdSdkModuleConfig'
import { CheqdSdkLedgerService } from './ledger'

export class CheqdSdkModule implements Module {
  public readonly config: CheqdSdkModuleConfig

  public constructor(config: CheqdSdkModuleConfigOptions) {
    this.config = new CheqdSdkModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Register config
    dependencyManager.registerInstance(CheqdSdkModuleConfig, this.config)

    dependencyManager.registerSingleton(CheqdSdkLedgerService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // not required
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)
    await cheqdSdkLedgerService.connect()
  }
}
