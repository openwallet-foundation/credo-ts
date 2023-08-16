import type { AriesAskar } from '@hyperledger/aries-askar-shared'

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
   * import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   ariesAskar: new AskarModule({
   *      ariesAskar,
   *   })
   *  }
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import { ariesAskar } from '@hyperledger/aries-askar-react-native'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   ariesAskar: new AskarModule({
   *      ariesAskar,
   *   })
   *  }
   * })
   * ```
   */
  ariesAskar: AriesAskar

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

  /** See {@link AskarModuleConfigOptions.ariesAskar} */
  public get ariesAskar() {
    return this.options.ariesAskar
  }

  /** See {@link AskarModuleConfigOptions.multiWalletDatabaseScheme} */
  public get multiWalletDatabaseScheme() {
    return this.options.multiWalletDatabaseScheme ?? AskarMultiWalletDatabaseScheme.DatabasePerWallet
  }
}
