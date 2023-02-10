import type { IndyVdrPoolConfig } from './pool'

export interface IndyVdrModuleConfigOptions {
  /**
   * Array of indy networks to connect to.
   *
   * [@default](https://github.com/default) []
   *
   * @example
   * ```
   * {
   *   isProduction: false,
   *   genesisTransactions: 'xxx',
   *   indyNamespace: 'localhost:test',
   *   transactionAuthorAgreement: {
   *     version: '1',
   *     acceptanceMechanism: 'accept'
   *   }
   * }
   * ```
   */
  networks: [IndyVdrPoolConfig, ...IndyVdrPoolConfig[]]
}

export class IndyVdrModuleConfig {
  private options: IndyVdrModuleConfigOptions

  public constructor(options: IndyVdrModuleConfigOptions) {
    this.options = options
  }

  /** See {@link IndyVdrModuleConfigOptions.networks} */
  public get networks() {
    return this.options.networks
  }
}
