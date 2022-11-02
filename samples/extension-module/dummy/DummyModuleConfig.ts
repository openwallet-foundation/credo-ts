/**
 * DummyModuleConfigOptions defines the interface for the options of the DummyModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DummyModuleConfigOptions {
  /**
   * Whether to automatically accept request messages.
   *
   * @default false
   */
  autoAcceptRequests?: boolean
}

export class DummyModuleConfig {
  private options: DummyModuleConfigOptions

  public constructor(options?: DummyModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link DummyModuleConfigOptions.autoAcceptRequests} */
  public get autoAcceptRequests() {
    return this.options.autoAcceptRequests ?? false
  }
}
