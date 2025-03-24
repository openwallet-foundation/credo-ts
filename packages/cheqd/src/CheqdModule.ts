import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { CheqdModuleConfigOptions } from './CheqdModuleConfig'

import { AgentConfig, Buffer } from '@credo-ts/core'

import { CheqdApi } from './CheqdApi'
import { CheqdModuleConfig } from './CheqdModuleConfig'
import { CheqdLedgerService } from './ledger'

export class CheqdModule implements Module {
  public readonly config: CheqdModuleConfig
  public readonly api = CheqdApi

  public constructor(config: CheqdModuleConfigOptions) {
    this.config = new CheqdModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@credo-ts/cheqd' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Register config
    dependencyManager.registerInstance(CheqdModuleConfig, this.config)

    dependencyManager.registerSingleton(CheqdLedgerService)

    // Cheqd module needs Buffer to be available globally
    // If it is not available yet, we overwrite it with the
    // Buffer implementation from Credo
    global.Buffer = global.Buffer || Buffer
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // not required
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    // We don't await it, as it impact startup time
    void cheqdLedgerService.connect()
  }
}
