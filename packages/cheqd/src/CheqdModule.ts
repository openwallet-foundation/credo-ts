import type { CheqdModuleConfigOptions } from './CheqdModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { CheqdModuleConfig } from './CheqdModuleConfig'
import { CheqdLedgerService } from './ledger'

export class CheqdModule implements Module {
  public readonly config: CheqdModuleConfig

  public constructor(config: CheqdModuleConfigOptions) {
    this.config = new CheqdModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/cheqd' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Register config
    dependencyManager.registerInstance(CheqdModuleConfig, this.config)

    dependencyManager.registerSingleton(CheqdLedgerService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // not required
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    await cheqdLedgerService.connect()
  }
}
