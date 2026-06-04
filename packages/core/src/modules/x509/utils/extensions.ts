import { DistributionPoint, DistributionPointName, GeneralName, Reason } from '@peculiar/asn1-x509'
import {
  AuthorityKeyIdentifierExtension,
  BasicConstraintsExtension,
  CRLDistributionPointsExtension,
  ExtendedKeyUsageExtension,
  IssuerAlternativeNameExtension,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  SubjectKeyIdentifierExtension,
} from '@peculiar/x509'
import { Hasher } from '../../../crypto/hashes/Hasher'
import { publicJwkToSpki } from '../../../crypto/webcrypto/utils'
import { TypedArrayEncoder } from '../../../utils'
import { PublicJwk } from '../../kms'
import type { X509CertificateExtensionsOptions } from '../X509ServiceOptions'

/**
 * X.509 extension OIDs defined in RFC 5280
 */
export enum X509ExtensionIdentifier {
  /** Basic Constraints (RFC 5280 Section 4.2.1.9) */
  BasicConstraints = '2.5.29.19',
  /** Key Usage (RFC 5280 Section 4.2.1.3) */
  KeyUsage = '2.5.29.15',
  /** Extended Key Usage (RFC 5280 Section 4.2.1.12) */
  ExtendedKeyUsage = '2.5.29.37',
  /** Subject Alternative Name (RFC 5280 Section 4.2.1.6) */
  SubjectAltName = '2.5.29.17',
  /** Issuer Alternative Name (RFC 5280 Section 4.2.1.7) */
  IssuerAltName = '2.5.29.18',
  /** Subject Key Identifier (RFC 5280 Section 4.2.1.2) */
  SubjectKeyIdentifier = '2.5.29.14',
  /** Authority Key Identifier (RFC 5280 Section 4.2.1.1) */
  AuthorityKeyIdentifier = '2.5.29.35',
  /** CRL Distribution Points (RFC 5280 Section 4.2.1.13) */
  CrlDistributionPoints = '2.5.29.31',
  /** Name Constraints (RFC 5280 Section 4.2.1.10) */
  NameConstraints = '2.5.29.30',
  /** Policy Constraints (RFC 5280 Section 4.2.1.11) */
  PolicyConstraints = '2.5.29.36',
}

export const createSubjectKeyIdentifierExtension = (
  options: X509CertificateExtensionsOptions['subjectKeyIdentifier'],
  additionalOptions: { publicJwk: PublicJwk }
) => {
  if (!options?.include) return

  const spki = publicJwkToSpki(additionalOptions.publicJwk)
  const hash = Hasher.hash(new Uint8Array(spki.subjectPublicKey), 'SHA-1')

  return new SubjectKeyIdentifierExtension(TypedArrayEncoder.toHex(hash))
}

export const createKeyUsagesExtension = (options: X509CertificateExtensionsOptions['keyUsage']) => {
  if (!options) return

  const flags = options.usages.reduce((prev, curr) => prev | curr, 0)

  return new KeyUsagesExtension(flags, options.markAsCritical)
}

export const createExtendedKeyUsagesExtension = (options: X509CertificateExtensionsOptions['extendedKeyUsage']) => {
  if (!options) return

  return new ExtendedKeyUsageExtension(options.usages, options.markAsCritical)
}

export const createAuthorityKeyIdentifierExtension = (
  options: X509CertificateExtensionsOptions['authorityKeyIdentifier'],
  additionalOptions: { publicJwk: PublicJwk }
) => {
  if (!options) return

  const spki = publicJwkToSpki(additionalOptions.publicJwk)
  const hash = Hasher.hash(new Uint8Array(spki.subjectPublicKey), 'SHA-1')

  return new AuthorityKeyIdentifierExtension(TypedArrayEncoder.toHex(hash), options.markAsCritical)
}

export const createIssuerAlternativeNameExtension = (
  options: X509CertificateExtensionsOptions['issuerAlternativeName']
) => {
  if (!options) return

  return new IssuerAlternativeNameExtension(options.name, options.markAsCritical)
}

export const createSubjectAlternativeNameExtension = (
  options: X509CertificateExtensionsOptions['subjectAlternativeName']
) => {
  if (!options) return

  return new SubjectAlternativeNameExtension(options.name, options.markAsCritical)
}

export const createBasicConstraintsExtension = (options: X509CertificateExtensionsOptions['basicConstraints']) => {
  if (!options) return

  return new BasicConstraintsExtension(options.ca, options.pathLenConstraint, options.markAsCritical)
}

export const createCrlDistributionPointsExtension = (
  options: X509CertificateExtensionsOptions['crlDistributionPoints']
) => {
  if (!options) return

  // Build a single distribution point whose `fullName` holds all URLs as alternate locations
  // (mirrors). This mirrors how {@link X509Certificate.crlDistributionPoints} parses the
  // extension (one distribution point with multiple URLs), so creation and parsing round-trip.
  const distributionPoint = new DistributionPoint({
    distributionPoint: new DistributionPointName({
      fullName: options.urls.map((url) => new GeneralName({ uniformResourceIdentifier: url })),
    }),
  })

  if (options.reasons && options.reasons.length > 0) {
    // The ASN.1 BIT STRING uses bit `i` for revocation reason code `i` (e.g. keyCompromise = bit 1).
    const reasonBits = options.reasons.reduce((mask, reason) => mask | (1 << reason), 0)
    const reason = new Reason()
    reason.fromNumber(reasonBits)
    distributionPoint.reasons = reason
  }

  if (options.crlIssuer) {
    distributionPoint.cRLIssuer = [new GeneralName({ uniformResourceIdentifier: options.crlIssuer })]
  }

  return new CRLDistributionPointsExtension([distributionPoint], options.markAsCritical)
}
