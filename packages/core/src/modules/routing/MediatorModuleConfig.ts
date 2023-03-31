/**
 * MediatorModuleConfigOptions defines the interface for the options of the MediatorModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface MediatorModuleConfigOptions {
  /**
   * Whether to automatically accept and grant incoming mediation requests.
   *
   * @default false
   */
  autoAcceptMediationRequests?: boolean
}

export class MediatorModuleConfig {
  private options: MediatorModuleConfigOptions

  public constructor(options?: MediatorModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link MediatorModuleConfigOptions.autoAcceptMediationRequests} */
  public get autoAcceptMediationRequests() {
    return this.options.autoAcceptMediationRequests ?? false
  }
}
