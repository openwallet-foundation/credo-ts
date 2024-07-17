import type { ExtensionInput } from './X509Certificate'
import type { Key } from '../../crypto/Key'

export interface X509ValidateCertificateChainOptions {
  certificateChain: Array<string>
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
  trustedCertificates?: [string, ...string[]]
}

export interface X509CreateSelfSignedCertificateOptions {
  key: Key
  extensions?: ExtensionInput
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
