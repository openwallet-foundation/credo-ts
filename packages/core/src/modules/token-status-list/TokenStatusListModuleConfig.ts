export interface TokenStatusListModuleConfigOptions {
  /**
   * Maximum size in bytes of a fetched status list. Applies to Token Status Lists, and to the status
   * and identifier lists of SD-JWT VCs and mdocs.
   *
   * @default the `maxResponseBytes` of the agent's `fetchLimits`
   */
  maxStatusListBytes?: number
}

/**
 * @public
 */
export class TokenStatusListModuleConfig {
  private options: TokenStatusListModuleConfigOptions

  public constructor(options?: TokenStatusListModuleConfigOptions) {
    this.options = options ?? {}
  }

  public get maxStatusListBytes() {
    return this.options.maxStatusListBytes
  }
}
