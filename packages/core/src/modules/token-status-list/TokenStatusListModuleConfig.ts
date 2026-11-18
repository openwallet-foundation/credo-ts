export interface TokenStatusListModuleConfigOptions {
  /**
   * Maximum size in bytes of a fetched status list. Applies to Token Status Lists, and to the status
   * and identifier lists of SD-JWT VCs and mdocs.
   *
   * @default the `maxResponseBytes` of the agent's `fetchLimits`
   */
  maxStatusListBytes?: number

  /**
   * Whether the x509 signer of an SD-JWT VC or mdoc status list, or of an mdoc identifier list, must have
   * the `id-kp-oauthStatusSigning` extended key usage, and `digitalSignature` if it has a Key Usage
   * extension, unless it uses the key of the credential issuer.
   *
   * @default false, as the extended key usage is only recommended by the Token Status List draft and optional in ISO/IEC 18013-5
   */
  requireStatusSigningKeyPurpose?: boolean

  /**
   * Maximum seconds to cache a fetched status list of an SD-JWT VC, or status or identifier list of an mdoc.
   * It is cached for its `ttl` and `exp` claims, up to this value, and not at all without either. Set to 0 to
   * disable the cache.
   *
   * @default 300 (5 minutes)
   */
  statusListCacheExpirySeconds?: number
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

  public get requireStatusSigningKeyPurpose() {
    return this.options.requireStatusSigningKeyPurpose ?? false
  }

  /** See {@link TokenStatusListModuleConfigOptions.statusListCacheExpirySeconds} */
  public get statusListCacheExpirySeconds() {
    return this.options.statusListCacheExpirySeconds ?? 300
  }
}
