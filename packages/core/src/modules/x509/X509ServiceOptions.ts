import type { GeneralNameType } from '@peculiar/x509'
import { PublicJwk } from '../kms'
import type { X509Certificate, X509ExtendedKeyUsage, X509KeyUsage } from './X509Certificate'

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
  certificateChain: Array<EncodedX509Certificate>

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

  trustedCertificates?: Array<EncodedX509Certificate>
}

export interface X509GetLeafCertificateOptions {
  certificateChain: Array<string>
}

export interface X509ParseCertificateOptions {
  encodedCertificate: string
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
