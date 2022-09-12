import type { DependencyManager, Module } from '../plugins'

import { SigningProviderToken, Bls12381g2SigningProvider } from '../crypto/signing-provider'

import { WalletApi } from './WalletApi'

// TODO: this should be moved into the modules directory
export class WalletModule implements Module {
  public readonly api = WalletApi

  /**
   * Registers the dependencies of the wallet module on the injection dependencyManager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(WalletApi)

    // Signing providers.
    dependencyManager.registerSingleton(SigningProviderToken, Bls12381g2SigningProvider)
  }
}
