import type { IndySdkPoolConfig } from './ledger'
import type * as IndySdk from 'indy-sdk'

/**
 * IndySdkModuleConfigOptions defines the interface for the options of the IndySdkModuleConfig class.
 */
export interface IndySdkModuleConfigOptions {
  /**
   * Implementation of the IndySdk interface according to the @types/indy-sdk package.
   *
   *
   * ## Node.JS
   *
   * ```ts
   * import * as indySdk from 'indy-sdk'
   *
   * const indySdkModule = new IndySdkModule({
   *   indySdk
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import * as indySdk from 'indy-sdk-react-native'
   *
   * const indySdkModule = new IndySdkModule({
   *   indySdk
   * })
   * ```
   */
  indySdk: typeof IndySdk

  /**
   * Array of indy networks to connect to. Each item in the list must include either the `genesisPath` or `genesisTransactions` property.
   *
   * @default []
   *
   * @example
   * ```
   * {
   *   isProduction: false,
   *   genesisPath: '/path/to/genesis.txn',
   *   indyNamespace: 'localhost:test',
   *   transactionAuthorAgreement: {
   *     version: '1',
   *     acceptanceMechanism: 'accept'
   *   }
   * }
   * ```
   */
  networks?: IndySdkPoolConfig[]
}

export class IndySdkModuleConfig {
  private options: IndySdkModuleConfigOptions

  public constructor(options: IndySdkModuleConfigOptions) {
    this.options = options
  }

  /** See {@link IndySdkModuleConfigOptions.indySdk} */
  public get indySdk() {
    return this.options.indySdk
  }

  public get networks() {
    return this.options.networks ?? []
  }
}
