import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { AskarModuleConfigOptions } from './AskarModuleConfig'

import { CredoError, InjectionSymbols } from '@credo-ts/core'
import { Store } from '@openwallet-foundation/askar-shared'

import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from './AskarModuleConfig'
import { AskarStorageService } from './storage'
import { assertAskarWallet } from './utils/assertAskarWallet'
import { AskarProfileWallet, AskarWallet } from './wallet'

export class AskarModule implements Module {
  public readonly config: AskarModuleConfig

  public constructor(config: AskarModuleConfigOptions) {
    this.config = new AskarModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(AskarModuleConfig, this.config)

    if (dependencyManager.isRegistered(InjectionSymbols.Wallet)) {
      throw new CredoError('There is an instance of Wallet already registered')
    }
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, AskarWallet)

    // If the multiWalletDatabaseScheme is set to ProfilePerWallet, we want to register the AskarProfileWallet
    if (this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.ProfilePerWallet) {
      dependencyManager.registerContextScoped(AskarProfileWallet)
    }

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError('There is an instance of StorageService already registered')
    }
    dependencyManager.registerSingleton(InjectionSymbols.StorageService, AskarStorageService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // We MUST use an askar wallet here
    assertAskarWallet(agentContext.wallet)

    const wallet = agentContext.wallet

    // Register the Askar store instance on the dependency manager
    // This allows it to be re-used for tenants
    agentContext.dependencyManager.registerInstance(Store, agentContext.wallet.store)

    // If the multiWalletDatabaseScheme is set to ProfilePerWallet, we want to register the AskarProfileWallet
    // and return that as the wallet for all tenants, but not for the main agent, that should use the AskarWallet
    if (this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.ProfilePerWallet) {
      agentContext.dependencyManager.container.register(InjectionSymbols.Wallet, {
        useFactory: (container) => {
          // If the container is the same as the root dependency manager container
          // it means we are in the main agent, and we should use the root wallet
          if (container === agentContext.dependencyManager.container) {
            return wallet
          }

          // Otherwise we want to return the AskarProfileWallet
          return container.resolve(AskarProfileWallet)
        },
      })
    }
  }
}
