import type { Askar, KdfMethod } from '@openwallet-foundation/askar-shared'
import type { AskarPostgresStorageConfig, AskarSqliteStorageConfig } from './AskarStorageConfig'

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

export interface AskarModuleConfigStoreOptions {
  /**
   * The id of the store, and also the default profile that will be used for the root agent instance.
   *
   * - When SQLite is used that is not in-memory this will influence the path where the SQLite database is stored.
   * - When Postgres is used, this determines the database.
   */
  id: string

  /**
   * The key to open the store
   */
  key: string

  /**
   * Key derivation method to use for opening the store.
   *
   * - `kdf:argon2i:mod` - most secure
   * - `kdf:argon2i:int` - faster, less secure
   * - `raw` - no key derivation. Useful if key is stored in e.g. the keychain on-device backed by biometrics.
   *
   * @default 'kdf:argon2i:mod'
   */
  keyDerivationMethod?: `${KdfMethod.Argon2IInt}` | `${KdfMethod.Argon2IMod}` | `${KdfMethod.Raw}`

  /**
   * The backend to use with backend specific configuraiton options.
   *
   * If not provided SQLite will be used by default
   */
  database?: AskarSqliteStorageConfig | AskarPostgresStorageConfig
}

export interface AskarModuleConfigOptions {
  /**
   * Store configuration used for askar.
   *
   * If `multiWalletDatabaseScheme` is set to `AskarMultiWalletDatabaseScheme.DatabasePerWallet` a new store will be created
   * for each tenant. For performance reasons it is recommended to use `AskarMultiWalletDatabaseScheme.ProfilePerWallet`.
   */
  store: AskarModuleConfigStoreOptions

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

  /**
   * Whether to enable and register the `AskarKeyManagementService` for key management and cryptographic operations.
   *
   * @default true
   */
  enableKms?: boolean

  /**
   * Whether to enable and register the `AskarStorageService` for storage
   *
   * @default true
   */
  enableStorage?: boolean
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

  public get store() {
    return this.options.store
  }

  public get enableKms() {
    return this.options.enableKms ?? true
  }

  public get enableStorage() {
    return this.options.enableStorage ?? true
  }
}
