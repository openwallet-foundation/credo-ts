import type { Mdoc } from '../modules/mdoc/Mdoc'
import type { SdJwtVc } from '../modules/sd-jwt-vc'
import type {
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2JwtVerifiableCredential,
  W3cV2SdJwtVerifiableCredential,
} from '../modules/vc'
import type { X509Certificate } from '../modules/x509/X509Certificate'
import type { AgentContext } from './context'

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
  issuance: string
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
    | W3cJsonLdVerifiableCredential
    | W3cJwtVerifiableCredential
    | W3cV2JwtVerifiableCredential
    | W3cV2SdJwtVerifiableCredential
}

/**
 * Reader authentication on an incoming mdoc request.
 *
 * The returned trusted issuers are the trust anchors the reader certificate chain of a single doc
 * request is validated against. Reader authentication is resolved per doc request, as every doc
 * request carries its own reader certificate chain.
 *
 * Return the leaf certificate from `signer.certificateChain` to trust a reader on the certificate
 * it presented itself, without establishing chain trust.
 */
export type VerificationTypeMdocReaderAuth = {
  type: 'mdocReaderAuth'

  /**
   * How the request reached the mdoc.
   *
   * Only the session transcript differs between mdoc exchanges; the doc request itself is the
   * same. An ISO/IEC TS 18013-7 Annex C (`org-iso-mdoc`) DC API request always carries the origin
   * it was received from, where other exchanges (e.g. ISO/IEC 18013-5 proximity) have no origin
   * and are added here as an additional member once supported.
   */
  exchange: {
    type: 'dcApi'

    /**
     * The origin the DC API request was received from.
     */
    origin: string
  }

  /**
   * The doctype of the doc request the reader authentication is for.
   */
  docType: string

  /**
   * Requested elements per namespace, mapped to their `intentToRetain` value.
   */
  nameSpaces: Record<string, Record<string, boolean>>
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
  verification: VerificationTypeCredential | VerificationTypeMdocReaderAuth | AdditionalVerificationTypes
}

/**
 * Signature for the `getTrustedIssuersForVerification` callback.
 *
 * Extension packages (e.g. `@credo-ts/openid4vc`) export additional verification types that can be
 * composed into the `AdditionalVerificationTypes` generic parameter to get full type coverage on
 * `verification`, e.g. `GetTrustedIssuersForVerification<VerificationSigner, OpenId4VcVerificationTypes>`.
 */
export type GetTrustedIssuersForVerification<
  Signer extends VerificationSigner = VerificationSigner,
  AdditionalVerificationTypes extends { type: string } = never,
> = (
  agentContext: AgentContext,
  context: TrustedIssuersForVerificationContext<Signer, AdditionalVerificationTypes>
) => Promise<TrustedIssuersForVerificationResult | undefined>
