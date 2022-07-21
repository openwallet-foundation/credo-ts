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
  private options: ConnectionsModuleConfigOptions

  public constructor(options?: ConnectionsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link ConnectionsModuleConfigOptions.autoAcceptConnections} */
  public get autoAcceptConnections() {
    return this.options.autoAcceptConnections ?? false
  }
}
