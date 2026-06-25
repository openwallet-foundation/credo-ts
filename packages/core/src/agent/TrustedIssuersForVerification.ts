import type { Mdoc } from '../modules/mdoc/Mdoc'
import type { SdJwtVc } from '../modules/sd-jwt-vc'
import type {
  W3cJwtVerifiableCredential,
  W3cV2JwtVerifiableCredential,
  W3cV2SdJwtVerifiableCredential,
} from '../modules/vc'
import type { X509Certificate } from '../modules/x509/X509Certificate'

export interface VerificationSignerDid {
  method: 'did'

  /**
   * The did url included in the signed object
   */
  didUrl: string
}

export interface VerificationSignerX509 {
  method: 'x509'

  /**
   * The certificate chain included in the signed object
   */
  certificateChain: X509Certificate[]
}

export type VerificationSigner = VerificationSignerDid | VerificationSignerX509

export interface TrustedIssuerDid {
  method: 'did'

  /** A DID that is trusted as an issuer */
  did: string
}

export interface TrustedIssuerX509 {
  method: 'x509'

  /** Base64 DER or PEM encoded certificate that is trusted as an issuer */
  issuance: string[]

  /** Base64 DER or PEM encoded certificate that are trusted as status list signers */
  status?: string[]
}

export type TrustedIssuer = TrustedIssuerDid | TrustedIssuerX509

export interface TrustedIssuersForVerificationResult<T extends TrustedIssuer = TrustedIssuer> {
  /**
   * The trusted issuers for this verification context.
   *
   * An empty array means "trust nothing" and will cause verification to fail (hard reject).
   * Return `undefined` from the callback to fall through to the next trust resolution layer.
   */
  trustedIssuers: T[]
}

export type VerificationTypeCredential = {
  type: 'credential'
  credential:
    | SdJwtVc
    | Mdoc
    | W3cJwtVerifiableCredential
    | W3cV2JwtVerifiableCredential
    | W3cV2SdJwtVerifiableCredential
}

export interface TrustedIssuersForVerificationContext<
  Signer extends VerificationSigner = VerificationSigner,
  AdditionalVerificationTypes extends { type: string } = never,
> {
  /**
   * The signer of the object.
   */
  signer: Signer

  /**
   * The context of the verification object
   */
  verification: VerificationTypeCredential | AdditionalVerificationTypes
}
