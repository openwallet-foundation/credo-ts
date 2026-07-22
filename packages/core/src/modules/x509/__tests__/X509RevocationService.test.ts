import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import type { InMemoryLruCache } from '../../cache'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { getCachedCrlSummary } from '../utils/crlFetcher'
import { X509Certificate, X509KeyUsage } from '../X509Certificate'
import {
  X509CertificateRevocationList,
  X509CertificateRevocationListEntryReason,
} from '../X509CertificateRevocationList'
import { X509RevocationReason } from '../X509CrlDistributionPoint'
import { X509ModuleConfig } from '../X509ModuleConfig'
import { X509RevocationService } from '../X509RevocationService'
import { X509Service } from '../X509Service'
import type { X509CreateCertificateRevocationListOptions } from '../X509ServiceOptions'
import { X509RevocationCheckMode, type X509RevocationCheckOptions } from '../X509ValidationOptions'
import {
  createP256Key,
  generateLeafWithPartitionedDistributionPoints,
  mockCrl,
  mockCrlHttpError,
  mockCrlNetworkError,
  setupCrlAgent,
} from './x509CrlTestUtils'

const FULL_URL = 'https://crl.example/full.crl'
const MIRROR_URL_A = 'https://mirror-a.example/full.crl'
const MIRROR_URL_B = 'https://mirror-b.example/full.crl'
const KEY_COMPROMISE_URL = 'https://crl.example/key-compromise.crl'

const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

describe('X509RevocationService', () => {
  let agent: Agent
  let agentContext: AgentContext
  let kmsApi: KeyManagementApi
  let cache: InMemoryLruCache

  let issuerKey: PublicJwk
  let issuerCertificate: X509Certificate
  let otherIssuerKey: PublicJwk

  beforeAll(async () => {
    ;({ agent, agentContext, kmsApi, cache } = await setupCrlAgent())

    issuerKey = await createP256Key(kmsApi)
    otherIssuerKey = await createP256Key(kmsApi)

    issuerCertificate = await X509Service.createCertificate(agentContext, {
      serialNumber: '01',
      issuer: { commonName: 'Issuer CA' },
      authorityKey: issuerKey,
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: { basicConstraints: { ca: true } },
    })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  beforeEach(() => {
    // Tests reuse CRL URLs, so clear the cache to avoid serving a stale CRL across cases.
    cache.clear()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  async function createLeaf(options: {
    serialNumber: string
    crlDistributionPoints?: { urls: string[]; reasons?: X509RevocationReason[]; crlIssuer?: string }
    /** When true, the certificate is created as a CA (basicConstraints cA = true). */
    ca?: boolean
  }): Promise<X509Certificate> {
    const extensions = {
      ...(options.crlDistributionPoints ? { crlDistributionPoints: options.crlDistributionPoints } : {}),
      ...(options.ca ? { basicConstraints: { ca: true } } : {}),
    }

    return X509Service.createCertificate(agentContext, {
      serialNumber: options.serialNumber,
      issuer: issuerCertificate.subject,
      authorityKey: issuerKey,
      subject: { commonName: `Leaf ${options.serialNumber}` },
      subjectPublicKey: await createP256Key(kmsApi),
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: Object.keys(extensions).length > 0 ? extensions : undefined,
    })
  }

  async function crlBytes(options: {
    entries?: Array<{ serialNumber: string; reason?: X509CertificateRevocationListEntryReason }>
    issuerKeyOverride?: PublicJwk
    nextUpdate?: Date
    thisUpdate?: Date
    extensions?: X509CreateCertificateRevocationListOptions['extensions']
  }) {
    const crl = await X509Service.createCertificateRevocationList(agentContext, {
      authorityKey: options.issuerKeyOverride ?? issuerKey,
      issuer: issuerCertificate.subject,
      validity: { thisUpdate: options.thisUpdate ?? lastMonth, nextUpdate: options.nextUpdate ?? nextMonth },
      entries: options.entries?.map((e) => ({
        serialNumber: e.serialNumber,
        revocationDate: lastMonth,
        reason: e.reason,
      })),
      extensions: options.extensions,
    })
    return crl.rawCertificateRevocationList
  }

  function checkRevocation(
    certificate: X509Certificate,
    issuerCertificate: X509Certificate,
    revocationCheckOptions: X509RevocationCheckOptions
  ) {
    return X509RevocationService.checkCertificateRevocation(agentContext, {
      certificate,
      issuerCertificate,
      revocationCheckOptions,
    })
  }

  it('returns valid without fetching when mode is Disabled', async () => {
    const leaf = await createLeaf({ serialNumber: '1001', crlDistributionPoints: { urls: [FULL_URL] } })
    const scope = mockCrl(FULL_URL, await crlBytes({ entries: [] }))

    const result = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Disabled,
    })

    expect(result.isValid).toBe(true)
    // The CRL was never fetched.
    expect(scope.isDone()).toBe(false)
  })

  it('returns valid when the certificate has no distribution points', async () => {
    const leaf = await createLeaf({ serialNumber: '1002' })

    const result = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })

    expect(result.isValid).toBe(true)
    expect(result.details).toContain('No CRL distribution points')
  })

  it('returns valid for a non-revoked certificate with a reachable full CRL', async () => {
    const leaf = await createLeaf({ serialNumber: '1003', crlDistributionPoints: { urls: [FULL_URL] } })
    mockCrl(FULL_URL, await crlBytes({ entries: [{ serialNumber: 'dead' }] }))

    const result = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })

    expect(result.isValid).toBe(true)
    expect(result.isRevoked).toBe(false)
    expect(result.method).toBe('crl')
  })

  it('detects a revoked certificate and fails in both SoftFail and Require modes', async () => {
    const leaf = await createLeaf({ serialNumber: '1004', crlDistributionPoints: { urls: [FULL_URL] } })
    // A verified summary is cached after the first check, so a single interceptor covers both checks.
    mockCrl(
      FULL_URL,
      await crlBytes({
        entries: [{ serialNumber: '1004', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
      })
    )

    for (const mode of [X509RevocationCheckMode.SoftFail, X509RevocationCheckMode.Require]) {
      const result = await checkRevocation(leaf, issuerCertificate, {
        mode,
      })
      expect(result.isValid).toBe(false)
      expect(result.isRevoked).toBe(true)
      expect(result.error?.message).toContain('has been revoked')
    }
  })

  it('passes on network error in SoftFail but fails in Require', async () => {
    const leaf = await createLeaf({ serialNumber: '1005', crlDistributionPoints: { urls: [FULL_URL] } })
    // A failed fetch is not cached, so both checks attempt a fetch.
    mockCrlNetworkError(FULL_URL, { times: 2 })

    const soft = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.SoftFail,
    })
    expect(soft.isValid).toBe(true)
    expect(soft.details).toContain('SoftFail')

    const required = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })
    expect(required.isValid).toBe(false)
    expect(required.error?.message).toContain('Required revocation check failed')
  })

  it('treats an HTTP error response as a fetch failure', async () => {
    const leaf = await createLeaf({ serialNumber: '1006', crlDistributionPoints: { urls: [FULL_URL] } })
    mockCrlHttpError(FULL_URL, 404)

    const required = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })
    expect(required.isValid).toBe(false)
  })

  it('fails both Require and SoftFail when the CRL signature does not verify', async () => {
    const leaf = await createLeaf({ serialNumber: '1007', crlDistributionPoints: { urls: [FULL_URL] } })
    // Sign the CRL with a different key than the issuer certificate. A CRL that fails verification
    // is not cached, so both checks fetch.
    mockCrl(FULL_URL, await crlBytes({ entries: [], issuerKeyOverride: otherIssuerKey }), { times: 2 })

    const required = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })
    expect(required.isValid).toBe(false)

    // A downloaded-but-invalid CRL is an integrity failure, not a network failure, so SoftFail does
    // not tolerate it.
    const soft = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.SoftFail,
    })
    expect(soft.isValid).toBe(false)
  })

  it('fails both Require and SoftFail when the CRL issuer name does not match the certificate issuer', async () => {
    const leaf = await createLeaf({ serialNumber: '100a', crlDistributionPoints: { urls: [FULL_URL] } })
    // Correctly signed by the issuer key, but the CRL carries a different issuer name. A rejected
    // CRL is not cached, so both checks fetch.
    mockCrl(
      FULL_URL,
      (
        await X509Service.createCertificateRevocationList(agentContext, {
          authorityKey: issuerKey,
          issuer: 'CN=Someone Else',
          validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
          entries: [],
        })
      ).rawCertificateRevocationList,
      { times: 2 }
    )

    const required = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })
    expect(required.isValid).toBe(false)

    // An issuer mismatch is an integrity failure, not a network failure, so SoftFail rejects it too.
    const soft = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.SoftFail,
    })
    expect(soft.isValid).toBe(false)
  })

  it('fails both Require and SoftFail when the CRL has expired', async () => {
    const leaf = await createLeaf({ serialNumber: '1008', crlDistributionPoints: { urls: [FULL_URL] } })
    // An expired CRL is not cached, so both checks fetch.
    mockCrl(FULL_URL, await crlBytes({ entries: [], thisUpdate: twoMonthsAgo, nextUpdate: lastMonth }), { times: 2 })

    const required = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })
    expect(required.isValid).toBe(false)
    expect(required.error?.message).toContain('expired')

    // An expired CRL is a staleness/integrity problem, not a network failure, so SoftFail does not
    // tolerate it either.
    const soft = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.SoftFail,
    })
    expect(soft.isValid).toBe(false)
  })

  it('falls back to a mirror URL when the first URL fails', async () => {
    const leaf = await createLeaf({
      serialNumber: '1009',
      crlDistributionPoints: { urls: [MIRROR_URL_A, MIRROR_URL_B] },
    })
    const mirrorA = mockCrlNetworkError(MIRROR_URL_A)
    const mirrorB = mockCrl(MIRROR_URL_B, await crlBytes({ entries: [] }))

    const result = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
    })
    expect(result.isValid).toBe(true)
    expect(mirrorA.isDone()).toBe(true)
    expect(mirrorB.isDone()).toBe(true)
  })

  describe('reason partitioning', () => {
    it('covers all reasons across multiple partitioned distribution points (not revoked)', async () => {
      const leaf = await X509Service.createCertificate(agentContext, {
        serialNumber: '2001',
        issuer: issuerCertificate.subject,
        authorityKey: issuerKey,
        subject: { commonName: 'Partitioned Leaf' },
        subjectPublicKey: await createP256Key(kmsApi),
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        // A partitioned distribution point that only covers the keyCompromise reason.
        extensions: {
          crlDistributionPoints: {
            urls: [KEY_COMPROMISE_URL],
            reasons: [X509RevocationReason.KeyCompromise],
          },
        },
      })

      mockCrl(KEY_COMPROMISE_URL, await crlBytes({ entries: [] }))

      // Only require the reason that is actually published.
      const result = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.Require,
        requiredReasons: [X509RevocationReason.KeyCompromise],
      })
      expect(result.isValid).toBe(true)
    })

    it('detects revocation via a partitioned distribution point (with a leading-zero serial)', async () => {
      const leaf = await X509Service.createCertificate(agentContext, {
        serialNumber: '00ab',
        issuer: issuerCertificate.subject,
        authorityKey: issuerKey,
        subject: { commonName: 'Partitioned Revoked Leaf' },
        subjectPublicKey: await createP256Key(kmsApi),
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        extensions: {
          crlDistributionPoints: {
            urls: [KEY_COMPROMISE_URL],
            reasons: [X509RevocationReason.KeyCompromise],
          },
        },
      })

      // Publish the revocation with a non-leading-zero serial to exercise normalization.
      mockCrl(
        KEY_COMPROMISE_URL,
        await crlBytes({
          entries: [{ serialNumber: 'ab', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
        })
      )

      const result = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.Require,
        requiredReasons: [X509RevocationReason.KeyCompromise],
      })
      expect(result.isValid).toBe(false)
      expect(result.isRevoked).toBe(true)
    })

    it('fails both Require and SoftFail when a required reason is published by no distribution point', async () => {
      const leaf = await createLeaf({
        serialNumber: '2003',
        crlDistributionPoints: { urls: [KEY_COMPROMISE_URL], reasons: [X509RevocationReason.KeyCompromise] },
      })

      // The DP only covers keyCompromise; require a reason no DP covers. No fetch is needed because
      // coverage of the required reasons cannot be satisfied. This is a structural gap, not a
      // network failure, so SoftFail must not tolerate it either.
      const required = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.Require,
        requiredReasons: [X509RevocationReason.KeyCompromise, X509RevocationReason.Superseded],
      })
      expect(required.isValid).toBe(false)
      expect(required.error?.message).toContain('revocation reasons')

      const soft = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.SoftFail,
        requiredReasons: [X509RevocationReason.KeyCompromise, X509RevocationReason.Superseded],
      })
      expect(soft.isValid).toBe(false)
    })

    it('passes SoftFail when a required partitioned reason is only unreachable due to a network error', async () => {
      const leaf = await createLeaf({
        serialNumber: '2004',
        crlDistributionPoints: { urls: [KEY_COMPROMISE_URL], reasons: [X509RevocationReason.KeyCompromise] },
      })

      // The DP publishes the required reason but cannot be fetched. The coverage gap is purely an
      // availability problem (no integrity failure, no structural gap), so SoftFail tolerates it
      // while Require does not. A failed fetch is not cached, so both checks attempt a fetch.
      mockCrlNetworkError(KEY_COMPROMISE_URL, { times: 2 })

      const required = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.Require,
        requiredReasons: [X509RevocationReason.KeyCompromise],
      })
      expect(required.isValid).toBe(false)

      const soft = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.SoftFail,
        requiredReasons: [X509RevocationReason.KeyCompromise],
      })
      expect(soft.isValid).toBe(true)
    })

    it('reports revoked from a reachable partition even when another required partition is unreachable', async () => {
      const SUPERSEDED_URL = 'https://crl.example/superseded.crl'
      const leaf = X509Certificate.fromRawCertificate(
        await generateLeafWithPartitionedDistributionPoints(agentContext, {
          issuerKey,
          issuerName: issuerCertificate.subject,
          subjectPublicKey: await createP256Key(kmsApi),
          subjectCommonName: 'Partitioned Revoked Leaf 2005',
          serialNumber: '2005',
          notBefore: lastMonth,
          notAfter: nextMonth,
          distributionPoints: [
            { url: KEY_COMPROMISE_URL, reason: X509RevocationReason.KeyCompromise },
            { url: SUPERSEDED_URL, reason: X509RevocationReason.Superseded },
          ],
        })
      )

      // The keyCompromise partition is reachable and lists the leaf as revoked; the superseded
      // partition is unreachable. The verified CRL is cached after the first check, so a single
      // interceptor covers both modes; the failed superseded fetch is never cached.
      mockCrl(
        KEY_COMPROMISE_URL,
        await crlBytes({
          entries: [{ serialNumber: '2005', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
        })
      )
      mockCrlNetworkError(SUPERSEDED_URL, { times: 2 })

      for (const mode of [X509RevocationCheckMode.SoftFail, X509RevocationCheckMode.Require]) {
        const result = await checkRevocation(leaf, issuerCertificate, { mode })
        expect(result.isValid).toBe(false)
        expect(result.isRevoked).toBe(true)
      }
    })

    it('reports revoked from a fetched partition even when required coverage is structurally incomplete', async () => {
      // A single partitioned DP (keyCompromise) lists the leaf as revoked, but a reason it does not
      // publish is also required. The revocation must still be reported rather than a coverage error.
      const leaf = await createLeaf({
        serialNumber: '2006',
        crlDistributionPoints: { urls: [KEY_COMPROMISE_URL], reasons: [X509RevocationReason.KeyCompromise] },
      })
      mockCrl(
        KEY_COMPROMISE_URL,
        await crlBytes({
          entries: [{ serialNumber: '2006', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
        })
      )

      for (const mode of [X509RevocationCheckMode.SoftFail, X509RevocationCheckMode.Require]) {
        const result = await checkRevocation(leaf, issuerCertificate, {
          mode,
          requiredReasons: [X509RevocationReason.KeyCompromise, X509RevocationReason.Superseded],
        })
        expect(result.isValid).toBe(false)
        expect(result.isRevoked).toBe(true)
      }
    })
  })

  it('treats an indirect-CRL distribution point as an unsupported feature rather than fetching it', async () => {
    const leaf = await createLeaf({
      serialNumber: '4001',
      crlDistributionPoints: { urls: [FULL_URL], crlIssuer: 'https://other-issuer.example/indirect.crl' },
    })
    // The DP is indirect (has a crlIssuer), so it must not be fetched/verified against our issuer.
    const scope = mockCrl(FULL_URL, await crlBytes({ entries: [] }))

    for (const mode of [X509RevocationCheckMode.SoftFail, X509RevocationCheckMode.Require]) {
      const result = await checkRevocation(leaf, issuerCertificate, { mode })
      // Unsupported coverage is an integrity-class failure, so it is not soft-failable.
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('Unsupported CRL feature')
    }
    // The indirect CRL URL was never fetched.
    expect(scope.isDone()).toBe(false)
  })

  it('honors a custom verificationDate for CRL expiry', async () => {
    const leaf = await createLeaf({ serialNumber: '3001', crlDistributionPoints: { urls: [FULL_URL] } })
    mockCrl(FULL_URL, await crlBytes({ entries: [], thisUpdate: twoMonthsAgo, nextUpdate: lastMonth }))

    // With a verificationDate before the CRL's nextUpdate, the CRL is still valid.
    const result = await checkRevocation(leaf, issuerCertificate, {
      mode: X509RevocationCheckMode.Require,
      verificationDate: new Date(twoMonthsAgo.getTime() + 24 * 60 * 60 * 1000),
    })
    expect(result.isValid).toBe(true)
  })

  describe('CRL scope and type validation', () => {
    // These CRLs are correctly signed and verify, but their own extensions (delta indicator /
    // issuing distribution point) mean they cannot be treated as an authoritative complete CRL for
    // the certificate being checked. The engine must reject them rather than concluding "not
    // revoked", and because the CRL was obtained the gap is an integrity (not soft-failable) failure.
    it('rejects a delta CRL instead of treating it as a complete CRL', async () => {
      const leaf = await createLeaf({ serialNumber: '4001', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(FULL_URL, await crlBytes({ entries: [], extensions: { deltaCrlIndicator: { value: 1 } } }))

      const result = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('delta CRL')
    })

    it('rejects an indirect CRL (issuing distribution point indirectCRL)', async () => {
      const leaf = await createLeaf({ serialNumber: '4002', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(
        FULL_URL,
        await crlBytes({ entries: [], extensions: { issuingDistributionPoint: { indirectCRL: true } } })
      )

      const result = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('indirect CRL')
    })

    it('rejects a CRL that only covers attribute certificates', async () => {
      const leaf = await createLeaf({ serialNumber: '4003', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(
        FULL_URL,
        await crlBytes({ entries: [], extensions: { issuingDistributionPoint: { onlyContainsAttributeCerts: true } } })
      )

      const result = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('attribute certificates')
    })

    it('rejects a user-certs-only CRL when checking a CA certificate', async () => {
      const caCertificate = await createLeaf({
        serialNumber: '4004',
        crlDistributionPoints: { urls: [FULL_URL] },
        ca: true,
      })
      mockCrl(
        FULL_URL,
        await crlBytes({ entries: [], extensions: { issuingDistributionPoint: { onlyContainsUserCerts: true } } })
      )

      const result = await checkRevocation(caCertificate, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('end-entity certificates')
    })

    it('rejects a CA-certs-only CRL when checking an end-entity certificate', async () => {
      const leaf = await createLeaf({ serialNumber: '4005', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(
        FULL_URL,
        await crlBytes({ entries: [], extensions: { issuingDistributionPoint: { onlyContainsCACerts: true } } })
      )

      const result = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('CA certificates')
    })

    it('uses an in-scope user-certs-only CRL to detect revocation of an end-entity certificate', async () => {
      const leaf = await createLeaf({ serialNumber: '4006', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(
        FULL_URL,
        await crlBytes({
          entries: [{ serialNumber: '4006', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
          extensions: { issuingDistributionPoint: { onlyContainsUserCerts: true } },
        })
      )

      const result = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(result.isValid).toBe(false)
      expect(result.isRevoked).toBe(true)
    })

    it('uses an in-scope CA-certs-only CRL when checking a CA certificate', async () => {
      const caCertificate = await createLeaf({
        serialNumber: '4007',
        crlDistributionPoints: { urls: [FULL_URL] },
        ca: true,
      })
      mockCrl(
        FULL_URL,
        await crlBytes({ entries: [], extensions: { issuingDistributionPoint: { onlyContainsCACerts: true } } })
      )

      const result = await checkRevocation(caCertificate, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(result.isValid).toBe(true)
      expect(result.isRevoked).toBe(false)
    })

    it('rejects a CRL bearing an unrecognized critical extension', async () => {
      const leaf = await createLeaf({ serialNumber: '4008', crlDistributionPoints: { urls: [FULL_URL] } })
      // A CRL Number marked critical violates RFC 5280 §5.2.3 (it MUST be non-critical) and is a
      // critical extension the engine must treat as unrecognized-for-criticality, so the CRL is
      // unusable. The CRL itself verifies, so it is cached and the second check reuses it.
      mockCrl(FULL_URL, await crlBytes({ entries: [], extensions: { crlNumber: { value: 1, markAsCritical: true } } }))

      const required = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(required.isValid).toBe(false)
      expect(required.error?.message).toContain('unrecognized critical extension')

      // Not soft-failable: the CRL was obtained, it just cannot be used.
      const soft = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(soft.isValid).toBe(false)
    })

    it('fails when the CRL issuer certificate is not authorized to sign CRLs (no cRLSign)', async () => {
      // Same key and subject as issuerCertificate, but a key usage that omits cRLSign. The CRL still
      // verifies (signature + issuer name), but the issuer is not authorized to sign CRLs.
      const issuerWithoutCrlSign = await X509Service.createCertificate(agentContext, {
        serialNumber: '0b',
        issuer: { commonName: 'Issuer CA' },
        authorityKey: issuerKey,
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        extensions: { basicConstraints: { ca: true }, keyUsage: { usages: [X509KeyUsage.KeyCertSign] } },
      })
      const leaf = await createLeaf({ serialNumber: '4009', crlDistributionPoints: { urls: [FULL_URL] } })
      // A rejected CRL is not cached, so both checks fetch.
      mockCrl(FULL_URL, await crlBytes({ entries: [] }), { times: 2 })

      const required = await checkRevocation(leaf, issuerWithoutCrlSign, { mode: X509RevocationCheckMode.Require })
      expect(required.isValid).toBe(false)
      expect(required.error?.message).toContain('cRLSign')

      // An unauthorized issuer is an integrity failure, not a network failure, so SoftFail rejects it.
      const soft = await checkRevocation(leaf, issuerWithoutCrlSign, { mode: X509RevocationCheckMode.SoftFail })
      expect(soft.isValid).toBe(false)
    })

    it('accepts a CRL whose issuer certificate has cRLSign key usage', async () => {
      const issuerWithCrlSign = await X509Service.createCertificate(agentContext, {
        serialNumber: '0c',
        issuer: { commonName: 'Issuer CA' },
        authorityKey: issuerKey,
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        extensions: {
          basicConstraints: { ca: true },
          keyUsage: { usages: [X509KeyUsage.KeyCertSign, X509KeyUsage.CrlSign] },
        },
      })
      const leaf = await createLeaf({ serialNumber: '400a', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(FULL_URL, await crlBytes({ entries: [] }))

      const result = await checkRevocation(leaf, issuerWithCrlSign, { mode: X509RevocationCheckMode.Require })
      expect(result.isValid).toBe(true)
      expect(result.isRevoked).toBe(false)
    })
  })

  describe('verified CRL summary cache', () => {
    let fromRawSpy: MockInstance

    beforeEach(() => {
      fromRawSpy = vi.spyOn(X509CertificateRevocationList, 'fromRaw')
    })

    afterEach(() => {
      fromRawSpy.mockRestore()
    })

    it('reuses the cached summary without fetching or parsing', async () => {
      const leaf = await createLeaf({ serialNumber: '5001', crlDistributionPoints: { urls: [FULL_URL] } })
      // A single interceptor: the second check must not fetch.
      mockCrl(FULL_URL, await crlBytes({ entries: [{ serialNumber: 'dead' }] }))

      const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(true)
      expect(fromRawSpy).toHaveBeenCalledTimes(1)

      const second = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(second).toEqual(first)
      // No additional parse: the check ran entirely from the cached summary.
      expect(fromRawSpy).toHaveBeenCalledTimes(1)
    })

    it('does not reuse a summary for an issuer certificate lacking cRLSign', async () => {
      // Same subject and key as the issuer that produced the summary, but a key usage without
      // cRLSign: the fast-path gate re-evaluates the cRLSign check on the provided certificate, so
      // the check falls back to a fresh fetch and full verification, failing on the missing cRLSign
      // key usage.
      const issuerWithCrlSign = await X509Service.createCertificate(agentContext, {
        serialNumber: '0d',
        issuer: { commonName: 'Issuer CA' },
        authorityKey: issuerKey,
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        extensions: {
          basicConstraints: { ca: true },
          keyUsage: { usages: [X509KeyUsage.KeyCertSign, X509KeyUsage.CrlSign] },
        },
      })
      const issuerWithoutCrlSign = await X509Service.createCertificate(agentContext, {
        serialNumber: '0e',
        issuer: { commonName: 'Issuer CA' },
        authorityKey: issuerKey,
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        extensions: { basicConstraints: { ca: true }, keyUsage: { usages: [X509KeyUsage.KeyCertSign] } },
      })
      const leaf = await createLeaf({ serialNumber: '5003', crlDistributionPoints: { urls: [FULL_URL] } })
      // The gate miss refetches, so both checks fetch.
      mockCrl(FULL_URL, await crlBytes({ entries: [] }), { times: 2 })

      const first = await checkRevocation(leaf, issuerWithCrlSign, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(true)

      const second = await checkRevocation(leaf, issuerWithoutCrlSign, { mode: X509RevocationCheckMode.SoftFail })
      expect(second.isValid).toBe(false)
      expect(second.error?.message).toContain('cRLSign')
    })

    it('reuses the summary for a rotated issuer certificate with the same subject and key', async () => {
      // The summary binds the issuer's subject name and public key — the inputs CRL verification
      // actually depends on — so a renewed CA certificate (same name and key, new serial/validity)
      // hits the summary directly without re-parsing.
      const rotatedIssuer = await X509Service.createCertificate(agentContext, {
        serialNumber: '0f',
        issuer: { commonName: 'Issuer CA' },
        authorityKey: issuerKey,
        validity: { notBefore: twoMonthsAgo, notAfter: nextMonth },
        extensions: { basicConstraints: { ca: true } },
      })
      const leaf = await createLeaf({ serialNumber: '5004', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(FULL_URL, await crlBytes({ entries: [] }))

      const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(true)
      expect(fromRawSpy).toHaveBeenCalledTimes(1)

      const second = await checkRevocation(leaf, rotatedIssuer, { mode: X509RevocationCheckMode.Require })
      expect(second.isValid).toBe(true)
      expect(fromRawSpy).toHaveBeenCalledTimes(1)
    })

    it('does not reuse a summary for an issuer certificate with the same name but a different key', async () => {
      const sameNameDifferentKeyIssuer = await X509Service.createCertificate(agentContext, {
        serialNumber: '10',
        issuer: { commonName: 'Issuer CA' },
        authorityKey: otherIssuerKey,
        validity: { notBefore: lastMonth, notAfter: nextMonth },
        extensions: { basicConstraints: { ca: true } },
      })
      const leaf = await createLeaf({ serialNumber: '500c', crlDistributionPoints: { urls: [FULL_URL] } })
      // The gate miss refetches, so both checks fetch.
      mockCrl(FULL_URL, await crlBytes({ entries: [] }), { times: 2 })

      const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(true)

      // Key thumbprint mismatch: the full re-verification fails on the signature.
      const second = await checkRevocation(leaf, sameNameDifferentKeyIssuer, {
        mode: X509RevocationCheckMode.SoftFail,
      })
      expect(second.isValid).toBe(false)
      expect(second.error?.message).toContain('signature')
    })

    it('falls back to full verification when the summary window does not cover the verification date', async () => {
      const leaf = await createLeaf({ serialNumber: '5005', crlDistributionPoints: { urls: [FULL_URL] } })
      const inWindow = new Date(twoMonthsAgo.getTime() + 24 * 60 * 60 * 1000)
      // Valid at `inWindow` but expired now. Each gate miss refetches, so all three checks fetch.
      mockCrl(FULL_URL, await crlBytes({ entries: [], thisUpdate: twoMonthsAgo, nextUpdate: lastMonth }), { times: 3 })

      const first = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.Require,
        verificationDate: inWindow,
      })
      expect(first.isValid).toBe(true)

      // The summary window check rejects the hit; the full path refetches and reproduces the expiry
      // failure, in both Require and SoftFail (integrity, not availability).
      const required = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(required.isValid).toBe(false)
      expect(required.error?.message).toContain('expired')

      const soft = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
      expect(soft.isValid).toBe(false)
    })

    it('falls back to full verification for a verification date before thisUpdate', async () => {
      const leaf = await createLeaf({ serialNumber: '5006', crlDistributionPoints: { urls: [FULL_URL] } })
      // The gate miss refetches, so both checks fetch.
      mockCrl(FULL_URL, await crlBytes({ entries: [] }), { times: 2 })

      const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(true)

      const result = await checkRevocation(leaf, issuerCertificate, {
        mode: X509RevocationCheckMode.Require,
        verificationDate: twoMonthsAgo,
      })
      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('not yet valid')
    })

    it('reports a revoked certificate identically from the summary, including serial normalization', async () => {
      const leaf = await createLeaf({ serialNumber: '00bd', crlDistributionPoints: { urls: [FULL_URL] } })
      // CRL entry 'bd' matches certificate serial '00bd' via normalization.
      mockCrl(
        FULL_URL,
        await crlBytes({
          entries: [{ serialNumber: 'bd', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
        })
      )

      const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(false)
      expect(first.isRevoked).toBe(true)

      const second = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(fromRawSpy).toHaveBeenCalledTimes(1)
      expect(second.isRevoked).toBe(true)
      expect(second.error?.message).toEqual(first.error?.message)
      expect(second.details).toEqual(first.details)
    })

    it('rejects an unusable CRL identically from the summary', async () => {
      const cases = [
        { serial: '5007', extensions: { deltaCrlIndicator: { value: 1 } }, message: 'delta CRL' },
        {
          serial: '5008',
          extensions: { crlNumber: { value: 1, markAsCritical: true } },
          message: 'unrecognized critical extension',
        },
        {
          serial: '5009',
          extensions: { issuingDistributionPoint: { onlyContainsUserCerts: true } },
          message: 'end-entity certificates',
          ca: true,
        },
      ] as const

      for (const { serial, extensions, message, ...rest } of cases) {
        const url = `https://crl.example/${serial}.crl`
        const leaf = await createLeaf({
          serialNumber: serial,
          crlDistributionPoints: { urls: [url] },
          ca: 'ca' in rest ? rest.ca : undefined,
        })
        mockCrl(url, await crlBytes({ entries: [], extensions }))

        const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
        expect(first.isValid).toBe(false)
        expect(first.error?.message).toContain(message)

        const parseCount = fromRawSpy.mock.calls.length
        const second = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.SoftFail })
        expect(second.isValid).toBe(false)
        expect(second.error?.message).toEqual(first.error?.message)
        expect(fromRawSpy.mock.calls.length).toBe(parseCount)
      }
    })

    it('treats a malformed cached summary as a miss', async () => {
      const leaf = await createLeaf({ serialNumber: '500a', crlDistributionPoints: { urls: [FULL_URL] } })
      await cache.set(agentContext, `x509:crl-summary:v1:${FULL_URL}`, { some: 'garbage' }, 3600, { scope: 'global' })
      // Single interceptor: the malformed summary causes one fetch, then the rewritten summary is used.
      mockCrl(FULL_URL, await crlBytes({ entries: [] }))

      const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(first.isValid).toBe(true)
      expect(fromRawSpy).toHaveBeenCalledTimes(1)
      // The malformed summary was overwritten with a valid one.
      expect(await getCachedCrlSummary(agentContext, FULL_URL)).not.toBeNull()

      const second = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
      expect(second.isValid).toBe(true)
      expect(fromRawSpy).toHaveBeenCalledTimes(1)
    })

    it('lets a second agent sharing the cache verify without fetching or parsing', async () => {
      const { agent: agentB, agentContext: agentContextB } = await setupCrlAgent({ cache })
      try {
        const leaf = await createLeaf({ serialNumber: '500b', crlDistributionPoints: { urls: [FULL_URL] } })
        const scope = mockCrl(FULL_URL, await crlBytes({ entries: [] }))

        const first = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
        expect(first.isValid).toBe(true)
        expect(scope.isDone()).toBe(true)

        const parseCount = fromRawSpy.mock.calls.length
        const second = await X509RevocationService.checkCertificateRevocation(agentContextB, {
          certificate: leaf,
          issuerCertificate,
          revocationCheckOptions: { mode: X509RevocationCheckMode.Require },
        })
        expect(second.isValid).toBe(true)
        expect(fromRawSpy.mock.calls.length).toBe(parseCount)
      } finally {
        await agentB.shutdown()
      }
    })

    it('caches the summary with the configured crlCacheExpirySeconds', async () => {
      const leaf = await createLeaf({ serialNumber: '500d', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(FULL_URL, await crlBytes({ entries: [] }))
      const setSpy = vi.spyOn(cache, 'set')

      try {
        // The CRL's nextUpdate is ~a month away, so the configured expiry is the effective TTL.
        const result = await checkRevocation(leaf, issuerCertificate, {
          mode: X509RevocationCheckMode.Require,
          crlCacheExpirySeconds: 123,
        })
        expect(result.isValid).toBe(true)
        expect(setSpy).toHaveBeenCalledWith(agentContext, `x509:crl-summary:v1:${FULL_URL}`, expect.anything(), 123, {
          scope: 'global',
        })
      } finally {
        setSpy.mockRestore()
      }
    })

    it('falls back to the module-config crlCacheExpirySeconds when per-call options omit it', async () => {
      const config = agentContext.dependencyManager.resolve(X509ModuleConfig)
      const leaf = await createLeaf({ serialNumber: '500e', crlDistributionPoints: { urls: [FULL_URL] } })
      mockCrl(FULL_URL, await crlBytes({ entries: [] }))
      const setSpy = vi.spyOn(cache, 'set')

      try {
        config.setRevocationCheck({ mode: X509RevocationCheckMode.Require, crlCacheExpirySeconds: 77 })

        const result = await checkRevocation(leaf, issuerCertificate, { mode: X509RevocationCheckMode.Require })
        expect(result.isValid).toBe(true)
        expect(setSpy).toHaveBeenCalledWith(agentContext, `x509:crl-summary:v1:${FULL_URL}`, expect.anything(), 77, {
          scope: 'global',
        })
      } finally {
        config.setRevocationCheck(undefined)
        setSpy.mockRestore()
      }
    })
  })
})
