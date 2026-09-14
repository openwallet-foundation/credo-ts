import { convertLegacyTrustedCertificates } from '../x509/utils/convertLegacyTrustedCertificates'
import { X509Certificate } from '../x509/X509Certificate'
import type { X509VerificationTrustedCertificates } from '../x509/X509ModuleConfig'
import { MdocError } from './MdocError'

export interface MdocTrustedCertificate {
  issuance: string[]
  status: string[]
  hasDedicatedStatusCertificates: boolean
}

/**
 * Falls back to the `issuance` certs when no `status` certs are configured (`status: undefined`); an
 * explicit `status: []` is passed through. {@link assertMdocStatusListChainsMatchIssuanceChain} then
 * keeps the fallback from widening the trust set.
 */
export function convertMdocTrustedCertificates(
  trustedCertificates: string[] | X509VerificationTrustedCertificates[]
): MdocTrustedCertificate[] {
  return convertLegacyTrustedCertificates(trustedCertificates).map(({ issuance, status }) => ({
    issuance,
    status: status ?? issuance,
    hasDedicatedStatusCertificates: status !== undefined,
  }))
}

/**
 * Maps the converted trusted certificates to the raw representation the `@owf/mdoc` library expects.
 */
export function mdocTrustedCertificatesToRaw(trustedCertificates: MdocTrustedCertificate[]) {
  return trustedCertificates.map(({ issuance, status }) => ({
    issuance: issuance.map((cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate),
    status: status.map((cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate),
  }))
}

/**
 * Without dedicated status certs, requires the status/identifier list chains to equal the issuance
 * chain, so the fallback can't accept a list signed by a different chain under the same trust anchor.
 */
export function assertMdocStatusListChainsMatchIssuanceChain(
  trustedCertificates: MdocTrustedCertificate[],
  chains: {
    trustedIssuanceChain: Uint8Array[]
    trustedStatusListChain?: Uint8Array[]
    trustedIdentifierListChain?: Uint8Array[]
  }
) {
  const issuanceChain = chains.trustedIssuanceChain.map((cert) => X509Certificate.fromRawCertificate(cert))
  const issuanceTrustAnchor = issuanceChain[issuanceChain.length - 1]

  const matchedTrustedCertificate = trustedCertificates.find(({ issuance }) =>
    issuance.some((cert) => X509Certificate.fromEncodedCertificate(cert).equal(issuanceTrustAnchor))
  )

  // With dedicated status certs the library already validated the lists against them.
  if (matchedTrustedCertificate?.hasDedicatedStatusCertificates) return

  const chainMatchesIssuanceChain = (chain: Uint8Array[]) => {
    const resolvedChain = chain.map((cert) => X509Certificate.fromRawCertificate(cert))
    return (
      resolvedChain.length === issuanceChain.length && resolvedChain.every((cert, i) => cert.equal(issuanceChain[i]))
    )
  }

  if (chains.trustedIdentifierListChain && !chainMatchesIssuanceChain(chains.trustedIdentifierListChain)) {
    throw new MdocError(
      'Trusted identifier list chain does not match the trusted issuance chain, and no trusted status certificates were provided for the trusted issuance certificate'
    )
  }

  if (chains.trustedStatusListChain && !chainMatchesIssuanceChain(chains.trustedStatusListChain)) {
    throw new MdocError(
      'Trusted status list chain does not match the trusted issuance chain, and no trusted status certificates were provided for the trusted issuance certificate'
    )
  }
}

export function nameSpacesRecordToMap<
  NamespaceValue,
  NameSpaces extends Record<string, Record<string, NamespaceValue>>,
>(nameSpaces: NameSpaces): Map<string, Map<string, NamespaceValue>> {
  return new Map(Object.entries(nameSpaces).map(([key, value]) => [key, new Map(Object.entries(value))] as const))
}

export function namespacesMapToRecord<NamespaceValue, NameSpaces extends Map<string, Map<string, NamespaceValue>>>(
  nameSpaces: NameSpaces
): Record<string, Record<string, NamespaceValue>> {
  return Object.fromEntries(
    Array.from(nameSpaces.entries()).map(([key, value]) => [key, Object.fromEntries(Array.from(value.entries()))])
  )
}
