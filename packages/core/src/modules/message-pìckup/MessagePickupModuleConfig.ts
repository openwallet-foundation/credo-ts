import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { MessageRepository } from '../../storage/MessageRepository'

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

  /**
   * Allows to specify a custom pickup message queue. It defaults to an in-memory repository
   *
   */
  messageRepository?: MessageRepository
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

  /** See {@link MessagePickupModuleConfig.protocols} */
  public get messageRepository() {
    return this.options.messageRepository
  }
}
