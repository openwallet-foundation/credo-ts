import type { AnonCredsRegistry } from './services'

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
   * Maximum credential number per revocation registry
   * @default 1000
   */
  maximumCredentialNumberPerRevocationRegistry?: number

  /**
   * Maximum credential number per revocation registry
   * @default agent's data path
   */
  tailsDirectoryPath?: string
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

  /** See {@link AnonCredsModuleConfigOptions.maximumCredentialNumberPerRevocationRegistry} */
  public get maximumCredentialNumberPerRevocationRegistry() {
    return this.options.maximumCredentialNumberPerRevocationRegistry ?? 1000
  }

  /** See {@link AnonCredsModuleConfigOptions.tailsDirectoryPath} */
  public get tailsDirectoryPath() {
    return this.options.tailsDirectoryPath
  }
}
