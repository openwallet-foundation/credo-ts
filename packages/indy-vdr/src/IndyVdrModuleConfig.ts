import type { IndyVdr } from '@hyperledger/indy-vdr-shared'
import type { IndyVdrPoolConfig } from './pool'

export interface IndyVdrModuleConfigOptions {
  /**
   *
   * ## Node.JS
   *
   * ```ts
   * import { indyVdr } from '@hyperledger/indy-vdr-nodejs';
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
   * import { indyVdr } from '@hyperledger/indy-vdr-react-native';
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
   */
  indyVdr: IndyVdr

  /**
   * Array of indy networks to connect to.
   *
   * @default []
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

  /**
   * Whether the did:indy ids of new schemas, credential definitions and revocation registries percent-encode
   * the schema name and tags, as the did:indy spec requires. This also applies to the schema and credential
   * definition ids in resolved objects. Agents that don't support percent-encoded ids can't resolve these ids.
   *
   * Ids in both forms are always accepted.
   *
   * @default false
   */
  encodeAnonCredsIdentifiers?: boolean
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

  /** See {@link IndyVdrModuleConfigOptions.encodeAnonCredsIdentifiers} */
  public get encodeAnonCredsIdentifiers() {
    return this.options.encodeAnonCredsIdentifiers ?? false
  }

  /** See {@link IndyVdrModuleConfigOptions.indyVdr} */
  public get indyVdr() {
    return this.options.indyVdr
  }
}
