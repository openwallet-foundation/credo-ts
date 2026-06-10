import type { X509VerificationTrustedCertificates } from '../X509ModuleConfig'

export function convertLegacyTrustedCertificates(
  trustedCertificates: string[] | X509VerificationTrustedCertificates[]
): X509VerificationTrustedCertificates[] {
  return trustedCertificates.every((tc) => typeof tc === 'string')
    ? trustedCertificates.map((tc) => ({ issuance: [tc] }))
    : (trustedCertificates as X509VerificationTrustedCertificates[])
}
