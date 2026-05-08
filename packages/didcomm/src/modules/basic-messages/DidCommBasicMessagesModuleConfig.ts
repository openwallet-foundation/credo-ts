import type { DidCommVersion } from '../../util/didcommVersion'
/**
 * DidCommBasicMessagesModuleConfigOptions defines the interface for the options of the DidCommBasicMessagesModuleConfig class.
 */
export interface DidCommBasicMessagesModuleConfigOptions {
  /**
   * Basic message protocol versions to enable.
   * - 1.0: Original BasicMessage (https://didcomm.org/basicmessage/1.0)
   * - 2.0: BasicMessage 2.0 (https://didcomm.org/basicmessage/2.0), works over both DIDComm v1 and v2
   *
   * @default ['v1']
   */
  protocols?: DidCommVersion[]
}

export class DidCommBasicMessagesModuleConfig {
  private options: DidCommBasicMessagesModuleConfigOptions

  public constructor(options?: DidCommBasicMessagesModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** Basic message protocol versions enabled. */
  public get protocols(): DidCommVersion[] {
    return this.options.protocols ?? ['v1']
  }

  /** Whether BasicMessage 1.0 is enabled. */
  public get supportsV1(): boolean {
    return this.protocols.includes('v1')
  }

  /** Whether BasicMessage 2.0 is enabled. */
  public get supportsV2(): boolean {
    return this.protocols.includes('v2')
  }
}
