import * as x509 from '@peculiar/x509'
import { X509Error } from '../X509Error'
import type { SingleValidationResult } from '../X509ValidationResult'
import { X509ExtensionIdentifier } from './extensions'

/**
 * Registry of critical extensions that Credo understands and can validate
 * Based on RFC 5280 Section 4.2
 */
export const knownCriticalExtensions = [
  X509ExtensionIdentifier.BasicConstraints,
  X509ExtensionIdentifier.KeyUsage,
  X509ExtensionIdentifier.ExtendedKeyUsage, // not always critical
  X509ExtensionIdentifier.SubjectAltName,
  X509ExtensionIdentifier.IssuerAltName,
  X509ExtensionIdentifier.SubjectKeyIdentifier, // typically not critical
  X509ExtensionIdentifier.AuthorityKeyIdentifier, // typically not critical
  X509ExtensionIdentifier.CrlDistributionPoints, // typically not critical
  // Extensions not yet validated by Credo but recognized:
  // X509ExtensionIdentifier.NameConstraints, // currently not validated
  // X509ExtensionIdentifier.PolicyConstraints, // currently not validated
]

export interface CriticalExtensionValidationResult {
  isValid: boolean
  unknownCriticalExtensions: string[]
  error?: Error
}

/**
 * Validates that all critical extensions in a certificate are understood by Credo
 * Per RFC 5280 Section 4.2: "A certificate-using system MUST reject the certificate if it encounters
 * a critical extension it does not recognize or a critical extension that contains information that it cannot process"
 */
export function validateCriticalExtensions(certificate: x509.X509Certificate): CriticalExtensionValidationResult {
  const unknownCriticalExtensions: string[] = []

  for (const extension of certificate.extensions) {
    if (extension.critical && !knownCriticalExtensions.includes(extension.type as X509ExtensionIdentifier)) {
      unknownCriticalExtensions.push(extension.type)
    }
  }

  if (unknownCriticalExtensions.length > 0) {
    return {
      isValid: false,
      unknownCriticalExtensions,
      error: new X509Error(
        `Certificate contains unknown critical extensions: ${unknownCriticalExtensions.join(', ')}. ` +
          `Per RFC 5280, certificates with unrecognized critical extensions MUST be rejected.`
      ),
    }
  }

  return { isValid: true, unknownCriticalExtensions: [] }
}

/**
 * Validates critical extensions for all certificates in a chain
 */
export function validateCriticalExtensionsForChain(certificates: x509.X509Certificate[]): SingleValidationResult {
  for (const cert of certificates) {
    const result = validateCriticalExtensions(cert)
    if (!result.isValid) {
      return {
        isValid: false,
        error: result.error,
        details: `Unknown critical extensions: ${result.unknownCriticalExtensions.join(', ')}`,
      }
    }
  }

  return { isValid: true }
}
