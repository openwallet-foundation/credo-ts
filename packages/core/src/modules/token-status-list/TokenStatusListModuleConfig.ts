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
}
