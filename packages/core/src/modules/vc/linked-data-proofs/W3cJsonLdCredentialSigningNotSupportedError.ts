import { CredoError } from '../../../error'

export type W3cJsonLdCredentialSigningNotSupportedReason =
  | 'no-compatible-verification-method'
  | 'no-verification-method-types-for-proof-type'
  | 'unsupported-key-type'
  | 'unsupported-proof-type'
  | 'unsupported-verification-method-type'
  | 'verification-method-not-controlled'

export class W3cJsonLdCredentialSigningNotSupportedError extends CredoError {
  public constructor(
    message: string,
    public readonly reason: W3cJsonLdCredentialSigningNotSupportedReason,
    cause?: Error
  ) {
    super(message, { cause })
  }
}
