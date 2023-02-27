import type { IndyVdrPoolConfig } from './pool'
import type { IndyVdr } from '@hyperledger/indy-vdr-shared'

export interface IndyVdrModuleConfigOptions {

    /**
   *
   * ## Node.JS
   *
   * ```ts
   * import * as indyVdr from '@hyperledger/indy-vdr-nodejs';
   * 
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   indyVdr: new IndyVdrModule({
   *      indyVdr,
   *   }) 
   *  }
   * })     
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import * as indyVdr from '@hyperledger/indy-vdr-react-native';
   * 
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   indyVdr: new IndyVdrModule({
   *      indyVdr,
   *   }) 
   *  }
   * })     
   * ```
   * ```
   */
    indyVdr: IndyVdr

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
