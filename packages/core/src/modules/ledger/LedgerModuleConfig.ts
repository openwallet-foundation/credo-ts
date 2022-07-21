import type { IndyPoolConfig } from './IndyPool'

/**
 * LedgerModuleConfigOptions defines the interface for the options of the RecipientModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface LedgerModuleConfigOptions {
  /**
   * Whether to automatically connect to all {@link LedgerModuleConfigOptions.indyLedgers} on startup.
   * This will be done asynchronously, so the initialization of the agent won't be impacted. However,
   * this does mean there may be unneeded connections to the ledger.
   *
   * @default true
   */
  connectToIndyLedgersOnStartup?: boolean

  /**
   * Array of configurations of indy ledgers to connect to. Each item in the list must include either the `genesisPath` or `genesisTransactions` property.
   *
   * The first ledger in the list will be used for writing transactions to the ledger.
   *
   * @default []
   */
  indyLedgers?: IndyPoolConfig[]
}

export class LedgerModuleConfig {
  private options: LedgerModuleConfigOptions

  public constructor(options?: LedgerModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link LedgerModuleConfigOptions.connectToIndyLedgersOnStartup} */
  public get connectToIndyLedgersOnStartup() {
    return this.options.connectToIndyLedgersOnStartup ?? true
  }

  /** See {@link LedgerModuleConfigOptions.indyLedgers} */
  public get indyLedgers() {
    return this.options.indyLedgers ?? []
  }
}
