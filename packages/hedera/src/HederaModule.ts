import type { HederaModuleConfigOptions } from './HederaModuleConfig'
import type { DependencyManager, Module } from '@credo-ts/core'

import { AgentConfig, Buffer } from '@credo-ts/core'

import { HederaModuleConfig } from './HederaModuleConfig'
import { HederaLedgerService } from './ledger'

export class HederaModule implements Module {
  public readonly config: HederaModuleConfig

  public constructor(config: HederaModuleConfigOptions) {
    this.config = new HederaModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@credo-ts/hedera' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Register config
    dependencyManager.registerInstance(HederaModuleConfig, this.config)
    dependencyManager.registerSingleton(HederaLedgerService)

    // Hedera module needs Buffer to be available globally
    // If it is not available yet, we overwrite it with the
    // Buffer implementation from Credo
    global.Buffer = global.Buffer || Buffer
  }
}
