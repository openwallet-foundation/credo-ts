/**
 * ConnectionsModuleConfigOptions defines the interface for the options of the ConnectionsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface ConnectionsModuleConfigOptions {
  /**
   * Whether to automatically accept connection messages. Applies to both the connection protocol (RFC 0160)
   * and the DID exchange protocol (RFC 0023).
   *
   * @default false
   */
  autoAcceptConnections?: boolean

  autoCreateConnectionOnFirstMessage?: boolean
}

export class ConnectionsModuleConfig {
  #autoAcceptConnections?: boolean
  #autoCreateConnectionOnFirstMessage?: boolean
  private options: ConnectionsModuleConfigOptions

  public constructor(options?: ConnectionsModuleConfigOptions) {
    this.options = options ?? {}
    this.#autoAcceptConnections = this.options.autoAcceptConnections
    this.#autoCreateConnectionOnFirstMessage = this.options.autoCreateConnectionOnFirstMessage
  }

  /** See {@link ConnectionsModuleConfigOptions.autoAcceptConnections} */
  public get autoAcceptConnections() {
    return this.#autoAcceptConnections ?? false
  }

  /** See {@link ConnectionsModuleConfigOptions.autoAcceptConnections} */
  public set autoAcceptConnections(autoAcceptConnections: boolean) {
    this.#autoAcceptConnections = autoAcceptConnections
  }

  /**
   * DidCommV2 specific.
   * Automatically create a connection state record when we receive a message targeted to the DID in the wallet,
   * but with non-existing pairwise record.
   * Reason for this behavior: Did Comm V2 does not define DID exchange protocol, but we need to have a connection record to act properly.
   *
   */
  public get autoCreateConnectionOnFirstMessage() {
    return this.#autoCreateConnectionOnFirstMessage ?? true
  }
}
