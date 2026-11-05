import type { OpenId4VciSignedMetadataPolicy } from './OpenId4VciHolderServiceOptions'

export interface OpenId4VcHolderModuleConfigOptions {
  /**
   * Whether to request signed credential issuer metadata. Can be overridden per call.
   *
   * - `required`: only accept signed metadata
   * - `preferred`: request signed metadata, but accept unsigned metadata if the issuer only serves that
   * - `disallowed`: only request unsigned metadata
   *
   * Signed metadata is only accepted if the signer is trusted, otherwise resolving the metadata fails.
   *
   * @default 'preferred'
   */
  signedMetadata?: OpenId4VciSignedMetadataPolicy
}

export class OpenId4VcHolderModuleConfig {
  private options: OpenId4VcHolderModuleConfigOptions

  public constructor(options?: OpenId4VcHolderModuleConfigOptions) {
    this.options = options ?? {}
  }

  /**
   * @default 'preferred'
   */
  public get signedMetadata(): OpenId4VciSignedMetadataPolicy {
    return this.options.signedMetadata ?? 'preferred'
  }
}
