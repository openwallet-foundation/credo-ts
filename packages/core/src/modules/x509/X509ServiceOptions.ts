import type { ExtensionInput } from './X509Certificate'
import type { Key } from '../../crypto/Key'

export interface X509ValidateCertificateChainOptions {
  certificateChain: Array<string>
  certificate?: string
  date?: Date
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
