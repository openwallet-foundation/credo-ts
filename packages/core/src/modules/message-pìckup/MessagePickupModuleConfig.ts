import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'

/**
 * MessagePickupModuleConfigOptions defines the interface for the options of the MessagePickupModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface MessagePickupModuleConfigOptions<MessagePickupProtocols extends MessagePickupProtocol[]> {
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
   * When not provided, V1MessagePickupProtocol and V2MessagePickupProtocol` are registered by default.
   *
   * @default
   * ```
   * [V1MessagePickupProtocol, V2MessagePickupProtocol]
   * ```
   */
  protocols: MessagePickupProtocols
}

export class MessagePickupModuleConfig<MessagePickupProtocols extends MessagePickupProtocol[]> {
  private options: MessagePickupModuleConfigOptions<MessagePickupProtocols>

  public constructor(options: MessagePickupModuleConfigOptions<MessagePickupProtocols>) {
    this.options = options
  }

  /** See {@link MessagePickupModuleConfig.maximumBatchSize} */
  public get maximumBatchSize() {
    return this.options.maximumBatchSize ?? 10
  }

  /** See {@link MessagePickupModuleConfig.protocols} */
  public get protocols() {
    return this.options.protocols
  }
}
