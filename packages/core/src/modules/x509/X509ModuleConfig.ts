import type { AgentContext } from '../../agent/context/AgentContext'
import type { VerificationTypeMdocReaderAuth } from '../../agent/TrustedIssuersForVerification'
import type { JwtPayload } from '../../crypto/jose/jwt/JwtPayload'
import type { Mdoc } from '../mdoc/Mdoc'
import type { SdJwtVc } from '../sd-jwt-vc/SdJwtVcService'
import type { W3cJwtVerifiableCredential } from '../vc/jwt-vc/W3cJwtVerifiableCredential'
import type { W3cJwtVerifiablePresentation } from '../vc/jwt-vc/W3cJwtVerifiablePresentation'
import { defaultX509ParseOptions } from './utils/parseOptions'
import { X509Certificate } from './X509Certificate'
import type { X509ParseOptions } from './X509ServiceOptions'
import {
  withX509RevocationCheckDefaults,
  type X509RevocationCheckOptions,
  type X509RevocationCheckOptionsWithDefaults,
} from './X509ValidationOptions'

export type X509VerificationTrustedCertificates = {
  issuance: string[]
  status?: string[]
}

export type X509VerificationTypeCredential = {
  type: 'credential'
  credential: SdJwtVc | Mdoc | W3cJwtVerifiableCredential | W3cJwtVerifiablePresentation

  /**
   * The `id` of the `DidCommProofRecord` that this verification is bound to.
   */
  didcommProofRecordId?: string

  /**
   * The `id` of the `OpenId4VcVerificationSessionRecord` that this verification is bound to.
   */
  openId4VcVerificationSessionId?: string
}

/**
 * Reader authentication on an incoming mdoc request.
 *
 * There is no separate legacy shape for this verification type: reader authentication is only
 * resolved on the DC API paths that were added after this callback was deprecated, so the type of
 * the `getTrustedIssuersForVerification` callback is reused as-is.
 */
export type X509VerificationTypeMdocReaderAuth = VerificationTypeMdocReaderAuth

// NOTE: we should probably move these to the OpenID4VC module
// but have to think about the typing. Probably the base interface should just contain
// the `verification` with a `type`. And extension modules can extend the verification
export type X509VerificationTypeOauth2SecuredAuthorizationRequest = {
  type: 'oauth2SecuredAuthorizationRequest'
  authorizationRequest: {
    jwt: string
    payload: JwtPayload
  }
}

export type X509VerificationTypeOpenId4VciKeyAttestation = {
  type: 'openId4VciKeyAttestation'

  /**
   * The `id` of the `OpenId4VcIssuanceSessionRecord` that this key
   * attestation verification is bound to.
   */
  // TODO: should be the record, but we don't have access to the record type here.
  openId4VcIssuanceSessionId: string

  // NOTE: it would be more helpful to have the typed JWT payload from openid4vc here?
  keyAttestation: {
    jwt: string
    payload: JwtPayload
  }
}

export type X509VerificationTypeOpenId4VciCredentialIssuerMetadata = {
  type: 'openId4VciCredentialIssuerMetadata'

  // NOTE: it would be more helpful to have the typed JWT payload from openid4vc here?
  credentialIssuerMetadata: {
    jwt: string
    payload: JwtPayload
  }
}

export type X509VerificationTypeOauth2ClientAttestation = {
  type: 'oauth2ClientAttestation'

  /**
   * The `id` of the `OpenId4VcIssuanceSessionRecord` that this client
   * attestation verification is bound to.
   */
  // TODO: should be the record, but we don't have access to the record type here.
  openId4VcIssuanceSessionId: string

  // NOTE: it would be more helpful to have the typed JWT payload from openid4vc here?
  clientAttestation: {
    jwt: string
    payload: JwtPayload
  }
}

export interface X509VerificationContext {
  /**
   * The certificate chain provided with the data to be verified. The trusted certificates
   * are determined before verification and thus it is not verified that the data was actually
   * signed by the private key associated with the leaf certificate in the certificate chain, or
   * whether the certificate chain is valid. However if the certificate
   * does not match, or is not valid, verification will always fail at a later stage
   */
  certificateChain: X509Certificate[]

  verification:
    | X509VerificationTypeCredential
    | X509VerificationTypeMdocReaderAuth
    | X509VerificationTypeOauth2SecuredAuthorizationRequest
    | X509VerificationTypeOauth2ClientAttestation
    | X509VerificationTypeOpenId4VciKeyAttestation
    | X509VerificationTypeOpenId4VciCredentialIssuerMetadata
}

export interface X509ModuleConfigOptions {
  /**
   *
   * Array of trusted base64-encoded certificate strings in the DER-format.
   */
  trustedCertificates?: Array<string | X509Certificate>

  /**
   * Optional callback method that will be called to dynamically get trusted certificates for a verification.
   * It will provide the `agentContext` and `verificationContext` allowing to dynamically set the trusted certificates
   * for a tenant or verification context.
   *
   * If no certificates should be trusted an empty array should be returned. If `undefined` is returned
   * it will fallback to the globally registered trusted certificates
   *
   * @deprecated use the global `getTrustedIssuersForVerification` instead
   * @returns An array of base64-encoded certificate strings or PEM certificate strings.
   */
  getTrustedCertificatesForVerification?(
    agentContext: AgentContext,
    verificationContext: X509VerificationContext
  ):
    | Promise<string[] | undefined | X509VerificationTrustedCertificates[]>
    | string[]
    | X509VerificationTrustedCertificates[]
    | undefined

  /**
   * Configuration for certificate revocation checking. Options that are not set use
   * {@link defaultX509RevocationCheckOptions}: `SoftFail` (do not fail on network error) for the
   * leaf and all intermediate CAs, a 5 second timeout, a 10 MB CRL size limit and a 1 hour cache.
   */
  revocationCheck?: X509RevocationCheckOptions

  /**
   * Resource limits applied when parsing DER/ASN.1 input, to bound the work done on untrusted
   * input. Replaces {@link defaultX509ParseOptions} in full rather than being merged with it, so
   * any limit left unset here falls back to the underlying parser default instead of Credo's.
   *
   * NOTE: this only applies to parsing performed by the X.509 module's own services (such as
   * `X509Service` and revocation checking). Certificates parsed elsewhere in the agent, for
   * example from an `x5c` header while verifying an SD-JWT VC or mdoc, do not have access to this
   * config and use {@link defaultX509ParseOptions}. Pass `parseOptions` to `X509Certificate` and
   * the other parsing factories directly to control those.
   */
  parseOptions?: X509ParseOptions
}

export class X509ModuleConfig {
  #trustedCertificates?: X509Certificate[]
  #getTrustedCertificatesForVerification?: X509ModuleConfigOptions['getTrustedCertificatesForVerification']
  #revocationCheck?: X509RevocationCheckOptions
  #parseOptions: X509ParseOptions

  public constructor(options?: X509ModuleConfigOptions) {
    // NOTE: must be set before the trusted certificates are parsed below
    this.#parseOptions = options?.parseOptions ?? defaultX509ParseOptions

    this.setTrustedCertificates(options?.trustedCertificates)
    if (options?.getTrustedCertificatesForVerification) {
      this.setTrustedCertificatesForVerification(options.getTrustedCertificatesForVerification)
    }
    if (options?.revocationCheck) {
      this.#revocationCheck = options.revocationCheck
    }
  }

  public get trustedCertificates() {
    // TODO: we should probably update this API to return the instances, but don't want to
    // break too much now
    return this.#trustedCertificates?.map((cert) => cert.toString('pem'))
  }

  /**
   * @deprecated use the global `getTrustedIssuersForVerification` instead
   */
  public get getTrustedCertificatesForVerification() {
    return this.#getTrustedCertificatesForVerification
  }

  /**
   * @deprecated use the global `getTrustedIssuersForVerification` instead
   */
  public setTrustedCertificatesForVerification(fn: X509ModuleConfigOptions['getTrustedCertificatesForVerification']) {
    this.#getTrustedCertificatesForVerification = fn
  }

  public get revocationCheck(): X509RevocationCheckOptionsWithDefaults {
    return withX509RevocationCheckDefaults(this.#revocationCheck)
  }

  public setRevocationCheck(options?: X509RevocationCheckOptions) {
    this.#revocationCheck = options
  }

  public get parseOptions(): X509ParseOptions {
    return this.#parseOptions
  }

  /**
   * Set the parse options, or restore {@link defaultX509ParseOptions} when passing `undefined`.
   */
  public setParseOptions(options?: X509ParseOptions) {
    this.#parseOptions = options ?? defaultX509ParseOptions
  }

  public setTrustedCertificates(trustedCertificates?: Array<string | X509Certificate>) {
    const certificateInstances = trustedCertificates?.map((trustedCertificate) =>
      typeof trustedCertificate === 'string'
        ? X509Certificate.fromEncodedCertificate(trustedCertificate, this.#parseOptions)
        : trustedCertificate
    )
    this.#trustedCertificates = trustedCertificates?.length ? certificateInstances : undefined
  }

  public addTrustedCertificate(trustedCertificate: string | X509Certificate) {
    const certificateInstance =
      typeof trustedCertificate === 'string'
        ? X509Certificate.fromEncodedCertificate(trustedCertificate, this.#parseOptions)
        : trustedCertificate

    if (!this.#trustedCertificates) {
      this.#trustedCertificates = []
    }

    this.#trustedCertificates.push(certificateInstance)
  }
}
