/**
 * DiscoverFeaturesModuleConfigOptions defines the interface for the options of the DiscoverFeaturesModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DiscoverFeaturesModuleConfigOptions {
  /**
   * Whether to automatically accept feature queries. Applies to all protocol versions.
   *
   * @default true
   */
  autoAcceptQueries?: boolean
}

export class DiscoverFeaturesModuleConfig {
  private options: DiscoverFeaturesModuleConfigOptions

  public constructor(options?: DiscoverFeaturesModuleConfigOptions) {
    this.options = options ?? {}
  }

  public get autoAcceptDiscoverFeatureQueries() {
    return this.options.autoAcceptQueries ?? true
  }
}
