import type { AskarModuleConfigOptions } from './AskarModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import { AriesFrameworkError, InjectionSymbols } from '@aries-framework/core'

import { AskarModuleConfig } from './AskarModuleConfig'
import { AskarStorageService } from './storage'
import { AskarWallet } from './wallet'

export class AskarModule implements Module {
  public readonly config: AskarModuleConfig

  public constructor(config: AskarModuleConfigOptions) {
    this.config = new AskarModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(AskarModuleConfig, this.config)

    if (dependencyManager.isRegistered(InjectionSymbols.Wallet)) {
      throw new AriesFrameworkError('There is an instance of Wallet already registered')
    } else {
      dependencyManager.registerContextScoped(InjectionSymbols.Wallet, AskarWallet)
    }

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new AriesFrameworkError('There is an instance of StorageService already registered')
    } else {
      dependencyManager.registerSingleton(InjectionSymbols.StorageService, AskarStorageService)
    }
  }
}
