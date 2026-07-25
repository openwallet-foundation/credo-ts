import { z } from 'zod'
import { Hasher } from '../../../crypto/hashes/Hasher'
import { TypedArrayEncoder } from '../../../utils'
import type { X509Certificate } from '../X509Certificate'
import type {
  X509CertificateRevocationList,
  X509CertificateRevocationListEntry,
  X509CertificateRevocationListEntryReason,
  X509IssuingDistributionPoint,
} from '../X509CertificateRevocationList'
import { normalizeSerialNumber } from './serialNumber'

/**
 * The subset of a verified CRL that the revocation engine consumes.
 *
 * Satisfied both by a freshly parsed and verified {@link X509CertificateRevocationList} and by a
 * cached {@link X509CrlSummary} (via {@link CrlSummaryVerifiedCrl}), so a cache hit does not need
 * to re-parse the CRL.
 */
export interface VerifiedCrl {
  readonly deltaCrlIndicator: number | undefined
  readonly issuingDistributionPoint: X509IssuingDistributionPoint | undefined
  readonly criticalExtensionIds: string[]
  findRevoked(certificate: X509Certificate): X509CertificateRevocationListEntry | null
}

/**
 * Plain-JSON summary of a verified CRL, cached so that subsequent revocation checks do not need to
 * re-parse the (potentially multi-MB) CRL. Must remain JSON-serializable so it survives
 * storage-backed cache implementations.
 */
const zX509CrlSummary = z
  .object({
    // The issuer binding captures what CRL verification actually depends on from the issuer
    // certificate: its subject name (issuer-name binding) and its public key (signature). The
    // remaining issuer-dependent check, cRLSign key usage, is re-evaluated on the certificate
    // provided at hit time, so a renewed or cross-certified issuer certificate with the same name
    // and key can reuse the summary.
    /** SHA-256 (hex) of the DER-encoded subject name of the issuer certificate */
    issuerNameSha256: z.string(),
    /** RFC 7638 JWK thumbprint (hex) of the issuer certificate's public key */
    issuerPublicJwkThumbprint: z.string(),
    /** `thisUpdate` as epoch milliseconds */
    thisUpdate: z.number(),
    /** `nextUpdate` as epoch milliseconds, absent when the CRL has none */
    nextUpdate: z.optional(z.number()),
    /** SHA-256 (hex) of the DER-encoded CRL bytes, used to revalidate a stale summary without re-parsing */
    crlSha256: z.string(),
    /** Epoch milliseconds after which the summary must be revalidated against freshly fetched CRL bytes */
    staleAt: z.number(),
    deltaCrlIndicator: z.optional(z.number()),
    issuingDistributionPoint: z.optional(
      z.object({
        fullName: z.array(z.string()),
        onlyContainsUserCerts: z.boolean(),
        onlyContainsCACerts: z.boolean(),
        onlySomeReasons: z.optional(z.array(z.number())),
        indirectCRL: z.boolean(),
        onlyContainsAttributeCerts: z.boolean(),
      })
    ),
    criticalExtensionIds: z.array(z.string()),
    // Parallel arrays with one slot per revoked entry, preserving CRL order so lookups keep the
    // first-match semantics of X509CertificateRevocationList.findRevoked.
    /** Original serial number strings as parsed from the CRL (not normalized) */
    serialNumbers: z.array(z.string()),
    /** Revocation date per entry as epoch milliseconds */
    revocationDates: z.array(z.number()),
    /** Revocation reason per entry, `null` when absent (`undefined` is not JSON-safe in arrays) */
    reasons: z.array(z.nullable(z.number())),
  })
  .refine(
    (summary) =>
      summary.serialNumbers.length === summary.revocationDates.length &&
      summary.serialNumbers.length === summary.reasons.length
  )

export type X509CrlSummary = z.output<typeof zX509CrlSummary>

/**
 * Guard for cached summaries. Anything that does not match the expected shape (older formats,
 * corrupted values) is treated as a cache miss by callers, never as an error, so this must not
 * throw. Callers must keep using the original object rather than zod's parsed copy: cloning would
 * copy the potentially huge entry arrays on every cache read and break the revoked-index
 * memoization, which is keyed on object identity.
 */
export function isX509CrlSummary(value: unknown): value is X509CrlSummary {
  return zX509CrlSummary.safeParse(value).success
}

export function computeIssuerNameSha256(issuerCertificate: X509Certificate): string {
  return TypedArrayEncoder.toHex(Hasher.hash(issuerCertificate.subjectNameBytes, 'SHA-256'))
}

export function computeIssuerPublicJwkThumbprint(issuerCertificate: X509Certificate): string {
  return TypedArrayEncoder.toHex(issuerCertificate.publicJwk.getJwkThumbprint())
}

export function computeCrlSha256(crlBytes: Uint8Array): string {
  return TypedArrayEncoder.toHex(Hasher.hash(crlBytes, 'SHA-256'))
}

/**
 * Derive the cacheable summary of a verified CRL.
 *
 * `staleAt` is caching policy (freshness deadline derived from the verification date and the
 * configured expiry), so it is provided by the caller rather than derived from the CRL.
 *
 * May throw for malformed CRLs (e.g. duplicate extensions, via the delta/issuing-distribution-point
 * getters); callers must then skip caching the summary so such CRLs keep their existing behavior.
 */
export function buildCrlSummary(
  crl: X509CertificateRevocationList,
  issuerCertificate: X509Certificate,
  staleAt: number
): X509CrlSummary {
  const serialNumbers: string[] = []
  const revocationDates: number[] = []
  const reasons: (number | null)[] = []
  for (const entry of crl.revokedCertificates) {
    serialNumbers.push(entry.serialNumber)
    revocationDates.push(entry.revocationDate.getTime())
    reasons.push(entry.reason ?? null)
  }

  const issuingDistributionPoint = crl.issuingDistributionPoint

  return {
    issuerNameSha256: computeIssuerNameSha256(issuerCertificate),
    issuerPublicJwkThumbprint: computeIssuerPublicJwkThumbprint(issuerCertificate),
    thisUpdate: crl.thisUpdate.getTime(),
    nextUpdate: crl.nextUpdate?.getTime(),
    crlSha256: computeCrlSha256(crl.rawCertificateRevocationList),
    staleAt,
    deltaCrlIndicator: crl.deltaCrlIndicator,
    issuingDistributionPoint: issuingDistributionPoint
      ? {
          fullName: issuingDistributionPoint.fullName,
          onlyContainsUserCerts: issuingDistributionPoint.onlyContainsUserCerts,
          onlyContainsCACerts: issuingDistributionPoint.onlyContainsCACerts,
          onlySomeReasons: issuingDistributionPoint.onlySomeReasons,
          indirectCRL: issuingDistributionPoint.indirectCRL,
          onlyContainsAttributeCerts: issuingDistributionPoint.onlyContainsAttributeCerts,
        }
      : undefined,
    criticalExtensionIds: crl.criticalExtensionIds,
    serialNumbers,
    revocationDates,
    reasons,
  }
}

// Lookup index per summary object. Keyed weakly so in-memory caches (which return the same summary
// object on every hit) only pay the index build once, while the summaries themselves can be evicted.
const revokedIndexBySummary = new WeakMap<X509CrlSummary, Map<string, number>>()

/**
 * {@link VerifiedCrl} view over a cached {@link X509CrlSummary}. Read-only: the summary may be a
 * shared reference owned by an in-memory cache and must never be mutated.
 */
export class CrlSummaryVerifiedCrl implements VerifiedCrl {
  public constructor(private readonly summary: X509CrlSummary) {}

  public get deltaCrlIndicator(): number | undefined {
    return this.summary.deltaCrlIndicator
  }

  public get issuingDistributionPoint(): X509IssuingDistributionPoint | undefined {
    const idp = this.summary.issuingDistributionPoint
    if (!idp) return undefined
    return {
      fullName: [...idp.fullName],
      onlyContainsUserCerts: idp.onlyContainsUserCerts,
      onlyContainsCACerts: idp.onlyContainsCACerts,
      onlySomeReasons: idp.onlySomeReasons ? [...idp.onlySomeReasons] : undefined,
      indirectCRL: idp.indirectCRL,
      onlyContainsAttributeCerts: idp.onlyContainsAttributeCerts,
    }
  }

  public get criticalExtensionIds(): string[] {
    return [...this.summary.criticalExtensionIds]
  }

  public findRevoked(certificate: X509Certificate): X509CertificateRevocationListEntry | null {
    const index = this.revokedIndex.get(normalizeSerialNumber(certificate.data.serialNumber))
    if (index === undefined) return null

    return {
      serialNumber: this.summary.serialNumbers[index],
      revocationDate: new Date(this.summary.revocationDates[index]),
      reason: (this.summary.reasons[index] ?? undefined) as X509CertificateRevocationListEntryReason | undefined,
    }
  }

  private get revokedIndex(): Map<string, number> {
    let index = revokedIndexBySummary.get(this.summary)
    if (!index) {
      index = new Map()
      for (let i = 0; i < this.summary.serialNumbers.length; i++) {
        const normalized = normalizeSerialNumber(this.summary.serialNumbers[i])
        // Keep the first occurrence of a duplicate serial, matching the linear scan of
        // X509CertificateRevocationList.findRevoked
        if (!index.has(normalized)) index.set(normalized, i)
      }
      revokedIndexBySummary.set(this.summary, index)
    }
    return index
  }
}
