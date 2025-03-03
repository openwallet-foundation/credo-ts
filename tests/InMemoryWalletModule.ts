import type { DependencyManager, Module } from '@credo-ts/core'

import { InMemoryStorageService } from './InMemoryStorageService'
import { InMemoryWallet } from './InMemoryWallet'

import { CredoError, InjectionSymbols } from '@credo-ts/core'

export class InMemoryWalletModule implements Module {
  public register(dependencyManager: DependencyManager) {
    if (dependencyManager.isRegistered(InjectionSymbols.Wallet)) {
      throw new CredoError('There is an instance of Wallet already registered')
    }
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, InMemoryWallet)

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError('There is an instance of StorageService already registered')
    }
    dependencyManager.registerSingleton(InjectionSymbols.StorageService, InMemoryStorageService)
  }
}
