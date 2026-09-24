import type { Anoncreds } from '@hyperledger/anoncreds-shared'
import type { AnonCredsRegistry } from './services'
import type { TailsFileService } from './services/tails'

import { BasicTailsFileService } from './services/tails'

/**
 * The `NativeAnoncreds` class exported from `@hyperledger/anoncreds-shared` (and re-exported by the platform packages).
 * It is typed structurally so versions of anoncreds-shared that don't export `NativeAnoncreds` remain supported.
 */
export interface NativeAnoncredsLike {
  readonly instance: Anoncreds
}

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
   * The anoncreds instance to use. You can pass either the `NativeAnoncreds` class, which resolves the registered
   * native binding lazily on each access, or an `Anoncreds` instance directly (e.g. the deprecated `anoncreds` export).
   *
   * Passing `NativeAnoncreds` is recommended, as the deprecated `anoncreds` export is only populated after the platform
   * package has been imported, which can result in `undefined` depending on import order (e.g. with ESM or bundlers).
   *
   * ## Node.JS
   *
   * ```ts
   * import { NativeAnoncreds } from '@hyperledger/anoncreds-nodejs'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   anoncreds: new AnoncredsModule({
   *      anoncreds: NativeAnoncreds,
   *   })
   *  }
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import { NativeAnoncreds } from '@hyperledger/anoncreds-react-native'
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   anoncreds: new AnoncredsModule({
   *      anoncreds: NativeAnoncreds,
   *   })
   *  }
   * })
   * ```
   */
  anoncreds: Anoncreds | NativeAnoncredsLike

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

  /** See {@link AnonCredsModuleConfigOptions.anoncreds} */
  public get anoncreds(): Anoncreds {
    const anoncreds = this.options.anoncreds

    // NativeAnoncreds resolves the registered native binding on each access
    return 'instance' in anoncreds ? anoncreds.instance : anoncreds
  }

  /** See {@link AnonCredsModuleConfigOptions.autoCreateLinkSecret} */
  public get autoCreateLinkSecret() {
    return this.options.autoCreateLinkSecret ?? true
  }
}
