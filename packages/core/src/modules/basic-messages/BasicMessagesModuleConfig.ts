import type { BasicMessageProtocol } from './protocols/BasicMessageProtocol'

/**
 * CredentialsModuleConfigOptions defines the interface for the options of the CredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface BasicMessagesModuleConfigOptions<BasicMessageProtocols extends BasicMessageProtocol[]> {
  /**
   * Protocols to make available to the module.
   *
   * When not provided, both `V1BasicMessageProtocol` and `V2BasicMessageProtocol` are registered by default.
   *
   * @default
   * ```
   * [V1BasicMessageProtocol, V2BasicMessageProtocol]
   * ```
   */
  basicMessageProtocols: BasicMessageProtocols
}

export class BasicMessagesModuleConfig<BasicMessagesProtocols extends BasicMessageProtocol[]> {
  private options: BasicMessagesModuleConfigOptions<BasicMessagesProtocols>

  public constructor(options: BasicMessagesModuleConfigOptions<BasicMessagesProtocols>) {
    this.options = options
  }

  /** See {@link BasicMessagesModuleConfigOptions.basicMessageProtocols} */
  public get basicMessageProtocols() {
    return this.options.basicMessageProtocols
  }
}
