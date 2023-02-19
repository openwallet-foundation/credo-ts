import type { DependencyManager, Module } from '@aries-framework/core'

import { AriesFrameworkError, InjectionSymbols } from '@aries-framework/core'

import { AskarStorageService } from './storage'
import { AskarWallet } from './wallet'

export class AskarModule implements Module {
  public register(dependencyManager: DependencyManager) {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      require('@hyperledger/aries-askar-nodejs')
    } catch (error) {
      try {
        require('@hyperledger/aries-askar-react-native')
      } catch (error) {
        throw new Error('Could not load aries-askar bindings')
      }
    }

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
