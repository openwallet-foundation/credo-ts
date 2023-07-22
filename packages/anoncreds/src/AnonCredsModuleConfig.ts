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
