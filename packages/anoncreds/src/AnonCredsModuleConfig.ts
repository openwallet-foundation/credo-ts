import type { Anoncreds } from '@hyperledger/anoncreds-shared'
import type { AnonCredsRegistry } from './services'
import type { TailsFileService } from './services/tails'

import { BasicTailsFileService } from './services/tails'

/**
 * @public
 * AnonCredsModuleConfigOptions defines the interface for the options of the AnonCredsModuleConfig class.
 */
export interface AnonCredsModuleConfigOptions {
  /**
   * A list of AnonCreds registries to make available to the AnonCreds module.
   */
  registries: [AnonCredsRegistry, ...AnonCredsRegistry[]]

  /**
   * Tails file service for download/uploading tails files
   * @default BasicTailsFileService (only for downloading tails files)
   */
  tailsFileService?: TailsFileService

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
   * Create a default link secret if there are no created link secrets.
   * @defaultValue true
   */
  autoCreateLinkSecret?: boolean
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

  /** See {@link AnonCredsModuleConfigOptions.tailsFileService} */
  public get tailsFileService() {
    return this.options.tailsFileService ?? new BasicTailsFileService()
  }

  public get anoncreds() {
    return this.options.anoncreds
  }

  /** See {@link AnonCredsModuleConfigOptions.autoCreateLinkSecret} */
  public get autoCreateLinkSecret() {
    return this.options.autoCreateLinkSecret ?? true
  }
}
