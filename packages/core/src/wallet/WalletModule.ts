import type { DependencyManager, Module } from '../plugins'

import { WalletApi } from './WalletApi'

// TODO: this should be moved into the modules directory
export class WalletModule implements Module {
  public readonly api = WalletApi

  /**
   * Registers the dependencies of the wallet module on the injection dependencyManager.
   */
  public register(_dependencyManager: DependencyManager) {
    // no-op, only API needs to be registered
  }
}
