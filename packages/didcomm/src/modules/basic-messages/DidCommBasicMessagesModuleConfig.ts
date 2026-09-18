import type { DidCommBasicMessageV2Service } from './protocol/v2'
import type { DidCommBasicMessageService } from './services'

export type DidCommBasicMessageProtocolVersion = (DidCommBasicMessageService | DidCommBasicMessageV2Service)['version']

/**
 * DidCommBasicMessagesModuleConfigOptions defines the interface for the options of the DidCommBasicMessagesModuleConfig class.
 */
export interface DidCommBasicMessagesModuleConfigOptions {
  /**
   * Basic message protocol versions to enable. A version is only registered when the matching
   * DIDComm version is also enabled in `DidCommModuleConfig.didcommVersions`.
   * @default ['v1', 'v2']
   */
  protocols?: DidCommBasicMessageProtocolVersion[]
}

export class DidCommBasicMessagesModuleConfig {
  private options: DidCommBasicMessagesModuleConfigOptions

  public constructor(options?: DidCommBasicMessagesModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** Basic message protocol versions enabled. */
  public get protocols(): DidCommBasicMessageProtocolVersion[] {
    return this.options.protocols ?? ['v1', 'v2']
  }
}
