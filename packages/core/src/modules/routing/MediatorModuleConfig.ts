/**
 * MediatorModuleConfigOptions defines the interface for the options of the RecipientModuleConfig class.
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

  /** See {@link RecipientModuleConfigOptions.autoAcceptMediationRequests} */
  public get autoAcceptMediationRequests() {
    return this.options.autoAcceptMediationRequests ?? false
  }
}
