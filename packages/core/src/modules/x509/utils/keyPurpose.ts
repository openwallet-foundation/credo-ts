import { type X509Certificate, type X509ExtendedKeyUsage, X509KeyUsage } from '../X509Certificate'
import { X509Error } from '../X509Error'
import type { X509CertificateSingleValidationResult } from '../X509ValidationResult'
import { X509ExtensionIdentifier } from './extensions'

/**
 * Validates that a certificate can be used for the required key usages. Per RFC 5280 section 4.2.1.3
 * the extension is optional, and a certificate without it is not restricted to specific key usages.
 */
export function validateRequiredKeyUsages(
  certificate: X509Certificate,
  requiredKeyUsages: X509KeyUsage[]
): X509CertificateSingleValidationResult {
  if (requiredKeyUsages.length === 0) return { isValid: true }

  // The decoded key usages can't tell a missing extension from one without any bits set.
  if (!certificate.hasExtension(X509ExtensionIdentifier.KeyUsage)) return { isValid: true }

  const keyUsage = certificate.keyUsage ?? []
  const missingKeyUsages = requiredKeyUsages.filter((usage) => !keyUsage.includes(usage))
  if (missingKeyUsages.length === 0) return { isValid: true }

  const names = missingKeyUsages.map((usage) => X509KeyUsage[usage]).join(', ')
  return {
    isValid: false,
    error: new X509Error(`Certificate '${certificate.subject}' does not have the required key usages: ${names}`),
    details: `Missing key usages: ${names}`,
  }
}

/**
 * Validates that a certificate has the required extended key usages. `anyExtendedKeyUsage` does not
 * count, as RFC 5280 section 4.2.1.12 allows rejecting it when a particular purpose is required.
 */
export function validateRequiredExtendedKeyUsages(
  certificate: X509Certificate,
  requiredExtendedKeyUsages: X509ExtendedKeyUsage[]
): X509CertificateSingleValidationResult {
  const missingExtendedKeyUsages = requiredExtendedKeyUsages.filter(
    (usage) => !certificate.extendedKeyUsage.includes(usage)
  )
  if (missingExtendedKeyUsages.length === 0) return { isValid: true }

  const oids = missingExtendedKeyUsages.join(', ')
  return {
    isValid: false,
    error: new X509Error(
      `Certificate '${certificate.subject}' does not have the required extended key usages: ${oids}`
    ),
    details: `Missing extended key usages: ${oids}`,
  }
}
