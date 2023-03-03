import type { AnonCredsRegistry } from './services'
import type { Anoncreds } from '@hyperledger/anoncreds-shared'

/**
 * @public
 * AnonCredsModuleConfigOptions defines the interface for the options of the AnonCredsModuleConfig class.
 */
export interface AnonCredsModuleConfigOptions {
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
   *   anoncreds: new AnoncredsModule({
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
   *   anoncreds: new AnoncredsModule({
   *      anoncreds,
   *   })
   *  }
   * })
   * ```
   */
  anoncreds: Anoncreds

  /**
   * A list of AnonCreds registries to make available to the AnonCreds module.
   */
  registries: [AnonCredsRegistry, ...AnonCredsRegistry[]]
}

/**
 * @public
 */
export class AnonCredsModuleConfig {
  private options: AnonCredsModuleConfigOptions

  public constructor(options: AnonCredsModuleConfigOptions) {
    this.options = options
  }

  /** See {@link AnonCredsModuleConfigOptions.registries} */
  public get registries() {
    return this.options.registries
  }
}
