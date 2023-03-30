/**
 * MessagePickupModuleConfigOptions defines the interface for the options of the MessagePickupModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface MessagePickupModuleConfigOptions {
  /**
   * Whether to automatically accept and grant incoming mediation requests.
   *
   * @default false
   */
  maximumMessagePickup?: number
}

export class MessagePickupModuleConfig {
  private options: MessagePickupModuleConfigOptions

  public constructor(options?: MessagePickupModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link MessagePickupModuleConfig.maximumMessagePickup} */
  public get maximumMessagePickup() {
    return this.options.maximumMessagePickup ?? 10
  }
}
