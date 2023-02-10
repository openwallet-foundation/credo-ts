import type { IndySdkModuleConfigOptions } from './IndySdkModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '@aries-framework/anoncreds'
import { InjectionSymbols } from '@aries-framework/core'

import { IndySdkModuleConfig } from './IndySdkModuleConfig'
import { IndySdkHolderService, IndySdkIssuerService, IndySdkVerifierService } from './anoncreds'
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

    // NOTE: for now we are registering the needed indy services. We may want to make this
    // more explicit and require the user to register the services they need on the specific modules.
    dependencyManager.registerSingleton(InjectionSymbols.Wallet, IndySdkWallet)
    dependencyManager.registerSingleton(InjectionSymbols.StorageService, IndySdkStorageService)
    dependencyManager.registerSingleton(AnonCredsIssuerServiceSymbol, IndySdkIssuerService)
    dependencyManager.registerSingleton(AnonCredsHolderServiceSymbol, IndySdkHolderService)
    dependencyManager.registerSingleton(AnonCredsVerifierServiceSymbol, IndySdkVerifierService)
  }
}
