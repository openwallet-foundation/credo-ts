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
}

export class ConnectionsModuleConfig {
  #autoAcceptConnections?: boolean
  private options: ConnectionsModuleConfigOptions

  public constructor(options?: ConnectionsModuleConfigOptions) {
    this.options = options ?? {}
    this.#autoAcceptConnections = this.options.autoAcceptConnections
  }

  /** See {@link ConnectionsModuleConfigOptions.autoAcceptConnections} */
  public get autoAcceptConnections() {
    return this.#autoAcceptConnections ?? false
  }

  /** See {@link ConnectionsModuleConfigOptions.autoAcceptConnections} */
  public set autoAcceptConnections(autoAcceptConnections: boolean) {
    this.#autoAcceptConnections = autoAcceptConnections
  }
}
