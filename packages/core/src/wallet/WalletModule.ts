import type { DependencyManager, Module } from '../plugins'

import { WalletApi } from './WalletApi'

// TODO: this should be moved into the modules directory
export class WalletModule implements Module {
  /**
   * Registers the dependencies of the wallet module on the injection dependencyManager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(WalletApi)
  }
}
