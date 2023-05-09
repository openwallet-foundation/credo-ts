import type { IndySdkModuleConfigOptions } from './IndySdkModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '@aries-framework/anoncreds'
import { AriesFrameworkError, InjectionSymbols } from '@aries-framework/core'

import { IndySdkModuleConfig } from './IndySdkModuleConfig'
import { IndySdkHolderService, IndySdkIssuerService, IndySdkVerifierService } from './anoncreds'
import { IndySdkPoolService } from './ledger'
import { IndySdkStorageService } from './storage'
import { IndySdkSymbol } from './types'
import { IndySdkWallet } from './wallet'

export class IndySdkModule implements Module {
  public readonly config: IndySdkModuleConfig

  public constructor(config: IndySdkModuleConfigOptions) {
    this.config = new IndySdkModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(IndySdkSymbol, this.config.indySdk)

    // Register config
    dependencyManager.registerInstance(IndySdkModuleConfig, this.config)

    if (dependencyManager.isRegistered(InjectionSymbols.Wallet)) {
      throw new AriesFrameworkError('There is an instance of Wallet already registered')
    } else {
      dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    }

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new AriesFrameworkError('There is an instance of StorageService already registered')
    } else {
      dependencyManager.registerSingleton(InjectionSymbols.StorageService, IndySdkStorageService)
    }

    // NOTE: for now we are registering the needed indy services. We may want to make this
    // more explicit and require the user to register the services they need on the specific modules.
    dependencyManager.registerSingleton(IndySdkPoolService)
    dependencyManager.registerSingleton(AnonCredsIssuerServiceSymbol, IndySdkIssuerService)
    dependencyManager.registerSingleton(AnonCredsHolderServiceSymbol, IndySdkHolderService)
    dependencyManager.registerSingleton(AnonCredsVerifierServiceSymbol, IndySdkVerifierService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    for (const pool of indySdkPoolService.pools) {
      if (pool.config.connectOnStartup) {
        await pool.connect()
      }
    }
  }
}
