import type { ExtensionInput } from './X509Certificate'
import type { Key } from '../../crypto/Key'

/**
 * Base64 or PEM
 */
export type EncodedX509Certificate = string

export interface X509ValidateCertificateChainOptions {
  certificateChain: Array<EncodedX509Certificate>

  certificate?: string
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
}

export interface X509CreateSelfSignedCertificateOptions {
  key: Key
  extensions?: ExtensionInput
  includeAuthorityKeyIdentifier?: boolean
  notBefore?: Date
  notAfter?: Date
  name?: string
}

export interface X509GetLefCertificateOptions {
  certificateChain: Array<string>
}

export interface X509ParseCertificateOptions {
  encodedCertificate: string
}
