import * as x509 from '@peculiar/x509'
import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import { TypedArrayEncoder } from '../../../utils'
import type { InMemoryLruCache } from '../../cache'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { X509Api } from '../X509Api'
import { X509Certificate } from '../X509Certificate'
import { X509RevocationReason } from '../X509CrlDistributionPoint'
import { X509Error } from '../X509Error'
import { X509RevocationService } from '../X509RevocationService'
import { X509Service } from '../X509Service'
import { X509RevocationCheckMode } from '../X509ValidationOptions'
import { createP256Key, generateCrl, mockCrl, mockCrlNetworkError, setupCrlAgent } from './x509CrlTestUtils'

const CRL_URL = 'https://crl.example/service.crl'

const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

describe('X509RevocationService CRL API', () => {
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
    cache.clear()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  async function createLeaf(serialNumber: string, reasons?: X509RevocationReason[]): Promise<X509Certificate> {
    return X509Service.createCertificate(agentContext, {
      serialNumber,
      issuer: issuerCertificate.subject,
      authorityKey: issuerKey,
      subject: { commonName: `Leaf ${serialNumber}` },
      subjectPublicKey: await createP256Key(kmsApi),
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: { crlDistributionPoints: { urls: [CRL_URL], reasons } },
    })
  }

  function crlBytes(options: {
    entries?: Array<{ serialNumber: string; reason?: x509.X509CrlReason }>
    issuerKeyOverride?: PublicJwk
    issuerNameOverride?: string
    nextUpdate?: Date
    thisUpdate?: Date
  }) {
    return generateCrl(agentContext, {
      issuerName: options.issuerNameOverride ?? issuerCertificate.subject,
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

  describe('checkCertificateRevocation', () => {
    it('returns valid for a non-revoked certificate', async () => {
      const leaf = await createLeaf('1001')
      mockCrl(CRL_URL, await crlBytes({ entries: [{ serialNumber: 'dead' }] }))

      const result = await X509RevocationService.checkCertificateRevocation(agentContext, {
        certificate: leaf,
        issuerCertificate,
        revocationCheckOptions: { mode: X509RevocationCheckMode.Require },
      })

      expect(result.isValid).toBe(true)
      expect(result.isRevoked).toBe(false)
    })

    it('detects a revoked certificate', async () => {
      const leaf = await createLeaf('1002')
      mockCrl(
        CRL_URL,
        await crlBytes({ entries: [{ serialNumber: '1002', reason: x509.X509CrlReason.keyCompromise }] })
      )

      const result = await X509RevocationService.checkCertificateRevocation(agentContext, {
        certificate: leaf,
        issuerCertificate,
        revocationCheckOptions: { mode: X509RevocationCheckMode.Require },
      })

      expect(result.isValid).toBe(false)
      expect(result.isRevoked).toBe(true)
    })

    it('accepts encoded (base64) certificates', async () => {
      const leaf = await createLeaf('1003')
      mockCrl(CRL_URL, await crlBytes({ entries: [] }))

      const result = await X509RevocationService.checkCertificateRevocation(agentContext, {
        certificate: leaf.toString('base64'),
        issuerCertificate: issuerCertificate.toString('base64'),
        revocationCheckOptions: { mode: X509RevocationCheckMode.Require },
      })

      expect(result.isValid).toBe(true)
    })

    it('defaults to the module-configured revocation options when none are passed', async () => {
      // The agent has no revocationCheck configured, so it falls back to SoftFail. A network error
      // therefore passes.
      const leaf = await createLeaf('1004')
      mockCrlNetworkError(CRL_URL)

      const result = await X509RevocationService.checkCertificateRevocation(agentContext, {
        certificate: leaf,
        issuerCertificate,
      })

      expect(result.isValid).toBe(true)
    })

    it('is reachable through X509Api', async () => {
      const leaf = await createLeaf('1005')
      mockCrl(CRL_URL, await crlBytes({ entries: [] }))

      const api = agentContext.dependencyManager.resolve(X509Api)
      const result = await api.checkCertificateRevocation({
        certificate: leaf,
        issuerCertificate,
        revocationCheckOptions: { mode: X509RevocationCheckMode.Require },
      })

      expect(result.isValid).toBe(true)
    })
  })

  describe('fetchCertificateRevocationList', () => {
    it('fetches and verifies a CRL against the issuer certificate', async () => {
      mockCrl(CRL_URL, await crlBytes({ entries: [{ serialNumber: 'beef' }] }))

      const crl = await X509RevocationService.fetchCertificateRevocationList(agentContext, {
        url: CRL_URL,
        issuerCertificate,
      })

      expect(crl.issuer).toBe(issuerCertificate.subject)
      expect(crl.revokedCount).toBe(1)
    })

    it('fetches without verifying when no issuer certificate is provided', async () => {
      // Signed by a different key, which would fail verification - but we do not verify here.
      mockCrl(CRL_URL, await crlBytes({ entries: [], issuerKeyOverride: otherIssuerKey }))

      const crl = await X509RevocationService.fetchCertificateRevocationList(agentContext, { url: CRL_URL })

      expect(crl.issuer).toBe(issuerCertificate.subject)
    })

    it('throws when the CRL signature does not verify', async () => {
      mockCrl(CRL_URL, await crlBytes({ entries: [], issuerKeyOverride: otherIssuerKey }))

      await expect(
        X509RevocationService.fetchCertificateRevocationList(agentContext, { url: CRL_URL, issuerCertificate })
      ).rejects.toThrow(X509Error)
    })

    it('throws when the CRL issuer name does not match', async () => {
      // Correctly signed, but carries a different issuer name.
      mockCrl(CRL_URL, await crlBytes({ entries: [], issuerNameOverride: 'CN=Someone Else' }))

      await expect(
        X509RevocationService.fetchCertificateRevocationList(agentContext, { url: CRL_URL, issuerCertificate })
      ).rejects.toThrow(/does not match/)
    })

    it('throws when the CRL has expired', async () => {
      mockCrl(CRL_URL, await crlBytes({ entries: [], thisUpdate: twoMonthsAgo, nextUpdate: lastMonth }))

      await expect(
        X509RevocationService.fetchCertificateRevocationList(agentContext, { url: CRL_URL, issuerCertificate })
      ).rejects.toThrow(/expired/)
    })

    it('throws when the CRL cannot be fetched', async () => {
      mockCrlNetworkError(CRL_URL)

      await expect(
        X509RevocationService.fetchCertificateRevocationList(agentContext, { url: CRL_URL, issuerCertificate })
      ).rejects.toThrow(X509Error)
    })
  })

  describe('parseCertificateRevocationList', () => {
    it('parses a base64-encoded CRL', async () => {
      const base64 = TypedArrayEncoder.toBase64(await crlBytes({ entries: [{ serialNumber: 'abc' }] }))

      const crl = X509RevocationService.parseCertificateRevocationList({
        encodedCertificateRevocationList: base64,
      })

      expect(crl.issuer).toBe(issuerCertificate.subject)
      expect(crl.revokedCount).toBe(1)
    })

    it('round-trips a PEM-encoded CRL', async () => {
      const base64 = TypedArrayEncoder.toBase64(await crlBytes({ entries: [] }))
      const pem = X509RevocationService.parseCertificateRevocationList({
        encodedCertificateRevocationList: base64,
      }).toString('pem')

      const crl = X509RevocationService.parseCertificateRevocationList({ encodedCertificateRevocationList: pem })

      expect(crl.issuer).toBe(issuerCertificate.subject)
    })

    it('throws on invalid input', () => {
      expect(() =>
        X509RevocationService.parseCertificateRevocationList({
          encodedCertificateRevocationList: 'not-a-crl',
        })
      ).toThrow(X509Error)
    })
  })
})
