import type { AriesAskar } from '@hyperledger/aries-askar-shared'

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
   * A list of Askar wallets to connect to.
   */
}

/**
 * @public
 */
export class AskarModuleConfig {
  private options: AskarModuleConfigOptions

  public constructor(options: AskarModuleConfigOptions) {
    this.options = options
  }

  public get ariesAskar() {
    return this.options.ariesAskar
  }
}
