import { DateOnly, DeviceNamespaces, DeviceSignedItems } from '@owf/mdoc'
import type { PublicJwk } from '../kms'
import { convertLegacyTrustedCertificates } from '../x509/utils/convertLegacyTrustedCertificates'
import { X509Certificate } from '../x509/X509Certificate'
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

/**
 * An mdoc element value as a query language like DCQL or DIF Presentation Exchange compares it with JSON values.
 *
 * The CBOR values that have a JSON primitive equivalent are converted: a full-date to its `YYYY-MM-DD` string, a
 * tdate to its RFC 3339 string, and an integer decoded as a bigint to a number. Any other value, such as a byte string
 * or an invalid date, is kept as it is: a query can ask for the element, but can't match a value or type against it.
 *
 * With `nested`, arrays are converted element by element, and maps to objects, for a query language whose paths go
 * into an element. A map only keeps its string keys, as a path addresses a member by its name, and two keys such as
 * `1` and `'1'` would otherwise become the same name.
 */
export function mdocElementValueForQuery(value: unknown, { nested = false }: { nested?: boolean } = {}): unknown {
  // An invalid date (from a malformed CBOR date string) has no string, so it is kept as it is
  if (value instanceof DateOnly) return toFullDateString(value) ?? value
  if (value instanceof Date) return isValidDate(value) ? toTdateString(value) : value
  if (typeof value === 'bigint') return Number.isSafeInteger(Number(value)) ? Number(value) : value
  if (!nested) return value

  if (Array.isArray(value)) return value.map((item) => mdocElementValueForQuery(item, { nested }))

  let entries: Array<[string, unknown]>
  if (value instanceof Map) {
    entries = Array.from(value.entries()).filter((entry): entry is [string, unknown] => typeof entry[0] === 'string')
  } else if (isPlainObject(value)) {
    entries = Object.entries(value)
  } else {
    return value
  }

  // `Object.fromEntries` defines own properties, so a `__proto__` key doesn't change the prototype
  return Object.fromEntries(entries.map(([key, item]) => [key, mdocElementValueForQuery(item, { nested })]))
}

/**
 * The mdoc name spaces as a query language compares them with JSON values, see {@link mdocElementValueForQuery}.
 */
export function mdocNameSpacesForQuery(nameSpaces: MdocNameSpaces, options: { nested?: boolean } = {}): MdocNameSpaces {
  return Object.fromEntries(
    Object.entries(nameSpaces).map(([nameSpace, elements]) => [
      nameSpace,
      Object.fromEntries(
        Object.entries(elements).map(([elementIdentifier, value]) => [
          elementIdentifier,
          mdocElementValueForQuery(value, options),
        ])
      ),
    ])
  )
}

function toFullDateString(date: DateOnly) {
  try {
    return date.toISOString()
  } catch {
    // `toISOString` throws a RangeError for an invalid date
    return undefined
  }
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime())
}

/**
 * A tdate as ISO 18013-5 encodes it: in UTC, without fractional seconds unless the date has them.
 */
function toTdateString(date: Date) {
  const isoString = date.toISOString()
  return date.getUTCMilliseconds() === 0 ? isoString.replace('.000Z', 'Z') : isoString
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
