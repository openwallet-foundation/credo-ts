import type { GeneralNameType } from '@peculiar/x509'
import { PublicJwk } from '../kms'
import type { X509Certificate, X509ExtendedKeyUsage, X509KeyUsage } from './X509Certificate'
import type { X509RevocationReason } from './X509CrlDistributionPoint'
import type { X509RevocationCheckOptions } from './X509ValidationOptions'

type AddMarkAsCritical<T extends Record<string, Record<string, unknown>>> = T & {
  [K in keyof T]: T[K] & {
    markAsCritical?: boolean
  }
}

/**
 * Base64 or PEM
 */
export type EncodedX509Certificate = string

export interface X509ValidateCertificateChainOptions {
  certificateChain: EncodedX509Certificate[]

  certificate?: EncodedX509Certificate

  /**
   * The date for which the certificate chain should be valid
   * @default new Date()
   *
   * The certificates must be valid on this date
   * according to the certificates certificate.notBefore and certificate.notAfter
   * otherwise, the validation will fail
   */
  verificationDate?: Date

  trustedCertificates?: EncodedX509Certificate[]

  /**
   * Whether to allow trusting intermediate or leaf certificates (non-root certificates)
   * as the root for verification.
   *
   * When true, validation can succeed if a trusted certificate is found in the chain
   * even if it's not self-signed (root certificate).
   *
   * This is useful for scenarios like ISO 18013-5 mDL where the root certificate
   * is not included in the chain, and you trust the leaf certificate directly as
   * the root certificate is not available. But it disables an important part of the
   * full certificate chain verification.
   *
   * When false, only self-signed root certificates in the trusted list will be accepted,
   * and the signature of any trusted intermediate must be verifiable.
   *
   * NOTE: the default behavior will change in a future version. If you rely on this value
   * being true, it is recommended to explicitly set it to true.
   *
   * @default true
   */
  allowNonRootTrustedCertificate?: boolean
}

export interface X509GetLeafCertificateOptions {
  certificateChain: Array<string>
}

export interface X509ParseCertificateOptions {
  encodedCertificate: string
}

export interface X509CheckCertificateRevocationOptions {
  /**
   * The certificate to check, as a base64/PEM-encoded string or an {@link X509Certificate} instance.
   */
  certificate: EncodedX509Certificate | X509Certificate

  /**
   * The issuer certificate that signed the CRL, as a base64/PEM-encoded string or an
   * {@link X509Certificate} instance. This is required to verify the CRL signature.
   */
  issuerCertificate: EncodedX509Certificate | X509Certificate

  /**
   * Options controlling how revocation is checked. When omitted, the module's configured
   * `revocationCheck` options are used, falling back to {@link X509RevocationCheckMode.SoftFail}.
   */
  revocationCheckOptions?: X509RevocationCheckOptions
}

export interface X509FetchCertificateRevocationListOptions {
  /**
   * The URL to fetch the CRL from.
   */
  url: string

  /**
   * The issuer certificate the CRL should be verified against, as a base64/PEM-encoded string or an
   * {@link X509Certificate} instance.
   *
   * When provided, the CRL signature, issuer name, and validity window are verified, and an error is
   * thrown on failure. When omitted, the CRL is fetched and parsed but NOT verified.
   */
  issuerCertificate?: EncodedX509Certificate | X509Certificate

  /**
   * Timeout in milliseconds for the CRL fetch.
   * @default 5000
   */
  timeoutMs?: number

  /**
   * Maximum size in bytes for the CRL download.
   * @default 10485760 (10 MB)
   */
  maxCrlSizeBytes?: number

  /**
   * The date used to check the CRL validity window (thisUpdate/nextUpdate). Only used when
   * `issuerCertificate` is provided.
   * @default new Date() (current time)
   */
  verificationDate?: Date
}

export interface X509ParseCertificateRevocationListOptions {
  /**
   * The CRL as a base64- or PEM-encoded string.
   */
  encodedCertificateRevocationList: string
}

export interface X509CreateCertificateChainOptions {
  certificates: Array<X509Certificate | string>
  outputFormat?: 'pem' | 'base64'
}

export type X509CertificateExtensionsOptions = AddMarkAsCritical<{
  subjectKeyIdentifier?: {
    include: boolean
  }
  keyUsage?: {
    usages: Array<X509KeyUsage>
  }
  extendedKeyUsage?: {
    usages: Array<X509ExtendedKeyUsage>
  }
  authorityKeyIdentifier?: {
    include: boolean
  }
  issuerAlternativeName?: {
    name: Array<{ type: GeneralNameType; value: string }>
  }
  subjectAlternativeName?: {
    name: Array<{ type: GeneralNameType; value: string }>
  }
  basicConstraints?: {
    ca: boolean
    pathLenConstraint?: number
  }
  crlDistributionPoints?: {
    urls: Array<string>

    /**
     * Revocation reasons covered by this distribution point.
     *
     * If omitted, this distribution point is a "full" distribution point covering all
     * revocation reasons. If provided, the distribution point only covers the given reasons.
     */
    reasons?: Array<X509RevocationReason>

    /**
     * The CRL issuer, when the CRL is issued by an entity other than the certificate issuer
     * (an indirect CRL), as a URI.
     *
     * NOTE: indirect CRLs are not verified during revocation checking; this is provided for
     * completeness so the created certificate matches what {@link X509Certificate.crlDistributionPoints}
     * can express.
     */
    crlIssuer?: string
  }
}>

export type X509CertificateSigningRequestExtensionsOptions = Pick<
  X509CertificateExtensionsOptions,
  'subjectKeyIdentifier' | 'keyUsage' | 'extendedKeyUsage' | 'subjectAlternativeName'
>

export interface X509CertificateIssuerAndSubjectOptions {
  countryName?: string
  stateOrProvinceName?: string
  organizationalUnit?: string
  commonName?: string
}

export interface X509CreateCertificateOptions {
  /**
   *
   * Serial number of the X.509 certificate
   *
   */
  serialNumber?: string

  /**
   *
   * The Key that will be used to sign the X.509 Certificate
   *
   */
  authorityKey: PublicJwk

  /**
   *
   * The key that is the subject of the X.509 Certificate
   *
   * If the `subjectPublicKey` is not included, the `authorityKey` will be used.
   * This means that the certificate is self-signed
   *
   */
  subjectPublicKey?: PublicJwk

  /**
   *
   * The issuer information of the X.509 Certificate
   *
   */
  issuer: string | X509CertificateIssuerAndSubjectOptions

  /**
   *
   * The subject information of the X.509 Certificate
   *
   * If the `subject` is not included, the `issuer` will be used
   *
   *
   */
  subject?: string | X509CertificateIssuerAndSubjectOptions

  /**
   *
   * Date range for when the X.509 Certificate is valid
   *
   */
  validity?: {
    /**
     *
     * Certificate is not valid before this date
     *
     */
    notBefore?: Date

    /**
     *
     * Certificate is not valid after this date
     *
     */
    notAfter?: Date
  }

  /**
   *
   * X.509 v3 Extensions to be added to the certificate
   *
   */
  extensions?: X509CertificateExtensionsOptions
}

export interface X509CreateCertificateSigningRequestOptions {
  /**
   * The key that is the subject of the certificate signing request.
   *
   * If you want to influence the specific signature algorithm to use
   * make sure to set the `alg` on the jwk.
   */
  subjectPublicKey: PublicJwk

  /**
   * The subject information of the certificate signing request
   */
  subject: string | X509CertificateIssuerAndSubjectOptions

  /**
   * X.509 v3 Extensions to be added to the certificate signing request
   */
  extensions?: X509CertificateSigningRequestExtensionsOptions
}

export interface X509ParseCertificateSigningRequestOptions {
  encodedCertificateSigningRequest: string
}
