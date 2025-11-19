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

export const createSubjectKeyIdentifierExtension = (
  options: X509CertificateExtensionsOptions['subjectKeyIdentifier'],
  additionalOptions: { publicJwk: PublicJwk }
) => {
  if (!options || !options.include) return

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

  return new CRLDistributionPointsExtension(options.urls, options.markAsCritical)
}
