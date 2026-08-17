import type { TrustedIssuerX509 } from '../../../agent/TrustedIssuersForVerification'
import type { X509VerificationTrustedCertificates } from '../X509ModuleConfig'

export function convertLegacyTrustedCertificates(
  trustedCertificates: string[] | X509VerificationTrustedCertificates[]
): X509VerificationTrustedCertificates[] {
  return trustedCertificates.every((tc) => typeof tc === 'string')
    ? trustedCertificates.map((tc) => ({ issuance: [tc] }))
    : (trustedCertificates as X509VerificationTrustedCertificates[])
}

export function legacyTrustedCertificatesToTrustedIssuers(
  trustedCertificates: string[] | X509VerificationTrustedCertificates[]
): TrustedIssuerX509[] {
  return convertLegacyTrustedCertificates(trustedCertificates).map((certificate) => ({
    method: 'x509',
    issuance: certificate.issuance,
    status: certificate.status,
  }))
}
