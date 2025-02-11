import type { Askar } from '@openwallet-foundation/askar-shared'

export enum AskarMultiWalletDatabaseScheme {
  /**
   * Each wallet get its own database and uses a separate store.
   */
  DatabasePerWallet = 'DatabasePerWallet',

  /**
   * All wallets are stored in a single database, but each wallet uses a separate profile.
   */
  ProfilePerWallet = 'ProfilePerWallet',
}

export interface AskarModuleConfigOptions {
  /**
   *
   * ## Node.JS
   *
   * ```ts
   * import { askar } from '@openwallet-foundation/askar-nodejs'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   askar: new AskarModule({
   *      askar,
   *   })
   *  }
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import { askar } from '@openwallet-foundation/askar-react-native'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   askar: new AskarModule({
   *      askar,
   *   })
   *  }
   * })
   * ```
   */
  askar: Askar

  /**
   * Determine the strategy for storing wallets if multiple wallets are used in a single agent.
   * This is mostly the case in multi-tenancy, and determines whether each tenant will get a separate
   * database, or whether all wallets will be stored in a single database, using a different profile
   * for each wallet.
   *
   * @default {@link AskarMultiWalletDatabaseScheme.DatabasePerWallet} (for backwards compatibility)
   */
  multiWalletDatabaseScheme?: AskarMultiWalletDatabaseScheme
}

/**
 * @public
 */
export class AskarModuleConfig {
  private options: AskarModuleConfigOptions

  public constructor(options: AskarModuleConfigOptions) {
    this.options = options
  }

  /** See {@link AskarModuleConfigOptions.askar} */
  public get askar() {
    return this.options.askar
  }

  /** See {@link AskarModuleConfigOptions.multiWalletDatabaseScheme} */
  public get multiWalletDatabaseScheme() {
    return this.options.multiWalletDatabaseScheme ?? AskarMultiWalletDatabaseScheme.DatabasePerWallet
  }
}
