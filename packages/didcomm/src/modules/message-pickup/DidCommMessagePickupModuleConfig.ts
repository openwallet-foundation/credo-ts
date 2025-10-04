import type { DidCommMessagePickupProtocol } from './protocol/DidCommMessagePickupProtocol'

/**
 * DidCommMessagePickupModuleConfigOptions defines the interface for the options of the DidCommMessagePickupModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidCommMessagePickupModuleConfigOptions<
  DidCommMessagePickupProtocols extends DidCommMessagePickupProtocol[],
> {
  /**
   * Maximum number of messages to retrieve in a single batch message pickup
   *
   * @default 10
   */
  maximumBatchSize?: number

  /**
   * Message pickup protocols to make available to the message pickup module. Only one protocol should be registered for each
   * protocol version.
   *
   * When not provided, DidCommMessagePickupV1Protocol and DidCommMessagePickupV2Protocol` are registered by default.
   *
   * @default
   * ```
   * [DidCommMessagePickupV1Protocol, DidCommMessagePickupV2Protocol]
   * ```
   */
  protocols: DidCommMessagePickupProtocols
}

export class DidCommMessagePickupModuleConfig<MessagePickupProtocols extends DidCommMessagePickupProtocol[]> {
  private options: DidCommMessagePickupModuleConfigOptions<MessagePickupProtocols>

  public constructor(options: DidCommMessagePickupModuleConfigOptions<MessagePickupProtocols>) {
    this.options = options
  }

  /** See {@link DidCommMessagePickupModuleConfig.maximumBatchSize} */
  public get maximumBatchSize() {
    return this.options.maximumBatchSize ?? 10
  }

  /** See {@link DidCommMessagePickupModuleConfig.protocols} */
  public get protocols() {
    return this.options.protocols
  }
}
