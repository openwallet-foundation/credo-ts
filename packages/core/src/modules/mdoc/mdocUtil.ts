import { DeviceNamespaces, DeviceSignedItems } from '@owf/mdoc'
import type { AgentContext } from '../../agent'
import { TypedArrayEncoder } from '../../utils/TypedArrayEncoder'
import type { PublicJwk } from '../kms'
import { convertLegacyTrustedCertificates } from '../x509/utils/convertLegacyTrustedCertificates'
import type { X509Certificate } from '../x509/X509Certificate'
import { X509CertificateCache } from '../x509/X509CertificateCache'
import type { X509VerificationTrustedCertificates } from '../x509/X509ModuleConfig'
import { MdocError } from './MdocError'
import type { MdocNameSpaces } from './MdocOptions'
import { isMdocSupportedSignatureAlgorithm, mdocSupportedSignatureAlgorithms } from './mdocSupportedAlgs'

/**
 * mdoc COSE structures require an explicit `alg`, but credo public JWKs generally don't carry one.
 */
export function getMdocSignatureAlgForJwk(publicJwk: PublicJwk) {
  const signatureAlgorithm = publicJwk.supportedSignatureAlgorithms.find(isMdocSupportedSignatureAlgorithm)
  if (!signatureAlgorithm) {
    throw new MdocError(
      `No supported signature algorithm found for jwk ${
        publicJwk.jwkTypeHumanDescription
      }. Key supports algs ${publicJwk.supportedSignatureAlgorithms.join(
        ', '
      )}. mdoc supports algs ${mdocSupportedSignatureAlgorithms.join(', ')}`
    )
  }

  return signatureAlgorithm
}

/**
 * The JSON representation of a public JWK, with `alg` filled in as the mdoc COSE structures require
 * it. The `kid` (needed to resolve the key for signing) is taken from the jwk as-is; it's up to the
 * caller to make sure the key id is set.
 */
export function mdocSigningJwk(publicJwk: PublicJwk) {
  const jwk = publicJwk.toJson()

  return {
    ...jwk,
    alg: jwk.alg ?? getMdocSignatureAlgForJwk(publicJwk),
  }
}

export interface MdocTrustedCertificate {
  issuance: X509Certificate[]
  status: X509Certificate[]
  hasDedicatedStatusCertificates: boolean
}

/**
 * Falls back to the `issuance` certs when no `status` certs are configured (`status: undefined`); an
 * explicit `status: []` is passed through. {@link assertMdocStatusListChainsMatchIssuanceChain} then
 * keeps the fallback from widening the trust set.
 */
export function convertMdocTrustedCertificates(
  agentContext: AgentContext,
  trustedCertificates: Array<string | X509Certificate> | X509VerificationTrustedCertificates[]
): MdocTrustedCertificate[] {
  const parse = (certificate: string | X509Certificate) =>
    X509CertificateCache.parseCertificate(agentContext, certificate)

  return convertLegacyTrustedCertificates(trustedCertificates).map(({ issuance, status }) => {
    const parsedIssuance = issuance.map(parse)

    return {
      issuance: parsedIssuance,
      status: status?.map(parse) ?? parsedIssuance,
      hasDedicatedStatusCertificates: status !== undefined,
    }
  })
}

// The `@owf/mdoc` library passes the bytes it gets from `mdocTrustedCertificatesToRaw` on to the
// `verifyCertificateChain` callback, which finds the parsed certificate here instead of parsing the bytes
const parsedTrustedCertificates = new WeakMap<Uint8Array, X509Certificate>()

/**
 * Maps the converted trusted certificates to the raw representation the `@owf/mdoc` library expects.
 */
export function mdocTrustedCertificatesToRaw(trustedCertificates: MdocTrustedCertificate[]) {
  const toRaw = (certificate: X509Certificate) => {
    const rawCertificate = certificate.rawCertificate
    parsedTrustedCertificates.set(rawCertificate, certificate)
    return rawCertificate
  }

  return trustedCertificates.map(({ issuance, status }) => ({
    issuance: issuance.map(toRaw),
    status: status.map(toRaw),
  }))
}

/**
 * The parsed certificate for bytes from {@link mdocTrustedCertificatesToRaw}, or the bytes when there is none.
 */
export function mdocRawToTrustedCertificate(rawCertificate: Uint8Array) {
  return parsedTrustedCertificates.get(rawCertificate) ?? rawCertificate
}

/**
 * Without dedicated status certs, requires the status/identifier list chains to equal the issuance
 * chain, so the fallback can't accept a list signed by a different chain under the same trust anchor.
 */
export function assertMdocStatusListChainsMatchIssuanceChain(
  agentContext: AgentContext,
  trustedCertificates: MdocTrustedCertificate[],
  chains: {
    trustedIssuanceChain: Uint8Array[]
    trustedStatusListChain?: Uint8Array[]
    trustedIdentifierListChain?: Uint8Array[]
  }
) {
  const issuanceTrustAnchor = X509CertificateCache.parseCertificate(
    agentContext,
    chains.trustedIssuanceChain[chains.trustedIssuanceChain.length - 1]
  )

  const matchedTrustedCertificate = trustedCertificates.find(({ issuance }) =>
    issuance.some((cert) => cert.equal(issuanceTrustAnchor))
  )

  // With dedicated status certs the library already validated the lists against them.
  if (matchedTrustedCertificate?.hasDedicatedStatusCertificates) return

  const chainMatchesIssuanceChain = (chain: Uint8Array[]) =>
    chain.length === chains.trustedIssuanceChain.length &&
    chain.every((cert, i) => TypedArrayEncoder.equals(cert, chains.trustedIssuanceChain[i]))

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

export function nameSpacesRecordToDeviceNamespaces(nameSpaces: MdocNameSpaces) {
  return DeviceNamespaces.create({
    deviceNamespaces: new Map(
      Array.from(nameSpacesRecordToMap(nameSpaces), ([nameSpace, items]) => [
        nameSpace,
        DeviceSignedItems.create({ deviceSignedItems: items }),
      ])
    ),
  })
}

export function namespacesMapToRecord<NamespaceValue, NameSpaces extends Map<string, Map<string, NamespaceValue>>>(
  nameSpaces: NameSpaces
): Record<string, Record<string, NamespaceValue>> {
  return Object.fromEntries(
    Array.from(nameSpaces.entries()).map(([key, value]) => [key, Object.fromEntries(Array.from(value.entries()))])
  )
}
