import * as x509 from '@peculiar/x509'
import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import type { InMemoryLruCache } from '../../cache'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { X509Certificate } from '../X509Certificate'
import { X509RevocationReason } from '../X509CrlDistributionPoint'
import { X509RevocationService } from '../X509RevocationService'
import { X509Service } from '../X509Service'
import { X509RevocationCheckMode, type X509RevocationCheckOptions } from '../X509ValidationOptions'
import {
  createP256Key,
  generateCrl,
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
  }): Promise<X509Certificate> {
    return X509Service.createCertificate(agentContext, {
      serialNumber: options.serialNumber,
      issuer: issuerCertificate.subject,
      authorityKey: issuerKey,
      subject: { commonName: `Leaf ${options.serialNumber}` },
      subjectPublicKey: await createP256Key(kmsApi),
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: options.crlDistributionPoints ? { crlDistributionPoints: options.crlDistributionPoints } : undefined,
    })
  }

  async function crlBytes(options: {
    entries?: Array<{ serialNumber: string; reason?: x509.X509CrlReason }>
    issuerKeyOverride?: PublicJwk
    nextUpdate?: Date
    thisUpdate?: Date
  }) {
    return generateCrl(agentContext, {
      issuerName: issuerCertificate.subject,
      issuerKey: options.issuerKeyOverride ?? issuerKey,
      thisUpdate: options.thisUpdate ?? lastMonth,
      nextUpdate: options.nextUpdate ?? nextMonth,
      entries: options.entries?.map((e) => ({
        serialNumber: e.serialNumber,
        revocationDate: lastMonth,
        reason: e.reason,
      })),
    })
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
    // The CRL bytes are cached after the first fetch, so a single interceptor covers both checks.
    mockCrl(FULL_URL, await crlBytes({ entries: [{ serialNumber: '1004', reason: x509.X509CrlReason.keyCompromise }] }))

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
      await generateCrl(agentContext, {
        issuerName: 'CN=Someone Else',
        issuerKey,
        thisUpdate: lastMonth,
        nextUpdate: nextMonth,
        entries: [],
      }),
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
        await crlBytes({ entries: [{ serialNumber: 'ab', reason: x509.X509CrlReason.keyCompromise }] })
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
        await crlBytes({ entries: [{ serialNumber: '2005', reason: x509.X509CrlReason.keyCompromise }] })
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
        await crlBytes({ entries: [{ serialNumber: '2006', reason: x509.X509CrlReason.keyCompromise }] })
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
})
