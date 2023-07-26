import type { Anoncreds } from '@hyperledger/anoncreds-shared'

/**
 * @public
 * AnonCredsRsModuleConfigOptions defines the interface for the options of the AnonCredsRsModuleConfig class.
 */
export interface AnonCredsRsModuleConfigOptions {
  /**
   *
   * ## Node.JS
   *
   * ```ts
   * import { anoncreds } from '@hyperledger/anoncreds-nodejs'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   anoncredsRs: new AnoncredsRsModule({
   *      anoncreds,
   *   })
   *  }
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import { anoncreds } from '@hyperledger/anoncreds-react-native'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   anoncredsRs: new AnoncredsRsModule({
   *      anoncreds,
   *   })
   *  }
   * })
   * ```
   */
  anoncreds: Anoncreds

  /**
   * Create a default link secret if there are no created link secrets.
   * @defaultValue true
   */
  autoCreateLinkSecret?: boolean
}

/**
 * @public
 */
export class AnonCredsRsModuleConfig {
  private options: AnonCredsRsModuleConfigOptions

  public constructor(options: AnonCredsRsModuleConfigOptions) {
    this.options = options
  }

  public get anoncreds() {
    return this.options.anoncreds
  }

  /** See {@link AnonCredsModuleConfigOptions.autoCreateLinkSecret} */
  public get autoCreateLinkSecret() {
    return this.options.autoCreateLinkSecret ?? true
  }
}
