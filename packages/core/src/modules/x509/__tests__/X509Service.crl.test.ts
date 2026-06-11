import * as x509 from '@peculiar/x509'
import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import { CredoWebCrypto } from '../../../crypto/webcrypto'
import { TypedArrayEncoder } from '../../../utils'
import type { InMemoryLruCache } from '../../cache'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { X509Api } from '../X509Api'
import { X509Certificate } from '../X509Certificate'
import { X509CertificateRevocationListEntryReason } from '../X509CertificateRevocationList'
import { X509RevocationReason } from '../X509CrlDistributionPoint'
import { X509Error } from '../X509Error'
import { X509RevocationService } from '../X509RevocationService'
import { X509Service } from '../X509Service'
import { X509RevocationCheckMode } from '../X509ValidationOptions'
import { createP256Key, mockCrl, mockCrlNetworkError, setupCrlAgent } from './x509CrlTestUtils'

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

  async function crlBytes(options: {
    entries?: Array<{ serialNumber: string; reason?: X509CertificateRevocationListEntryReason }>
    issuerKeyOverride?: PublicJwk
    issuerNameOverride?: string
    nextUpdate?: Date
    thisUpdate?: Date
  }) {
    const crl = await X509Service.createCertificateRevocationList(agentContext, {
      authorityKey: options.issuerKeyOverride ?? issuerKey,
      issuer: options.issuerNameOverride ?? issuerCertificate.subject,
      validity: { thisUpdate: options.thisUpdate ?? lastMonth, nextUpdate: options.nextUpdate ?? nextMonth },
      entries: options.entries?.map((e) => ({
        serialNumber: e.serialNumber,
        revocationDate: lastMonth,
        reason: e.reason,
      })),
    })
    return crl.rawCertificateRevocationList
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
        await crlBytes({
          entries: [{ serialNumber: '1002', reason: X509CertificateRevocationListEntryReason.KeyCompromise }],
        })
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

  describe('createCertificateRevocationList', () => {
    it('creates a signed CRL with the expected issuer and validity dates', async () => {
      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        entries: [
          {
            serialNumber: '0a1b2c',
            revocationDate: lastMonth,
            reason: X509CertificateRevocationListEntryReason.KeyCompromise,
          },
        ],
      })

      expect(crl.issuer).toBe(issuerCertificate.subject)
      // CRL dates are encoded at one-second resolution.
      expect(Math.floor(crl.thisUpdate.getTime() / 1000)).toBe(Math.floor(lastMonth.getTime() / 1000))
      expect(Math.floor((crl.nextUpdate?.getTime() ?? 0) / 1000)).toBe(Math.floor(nextMonth.getTime() / 1000))
      expect(crl.revokedCount).toBe(1)
    })

    it('accepts an entry given as a serial number or as a certificate, and round-trips the reason', async () => {
      const revokedLeaf = await createLeaf('aa55')

      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        entries: [
          { serialNumber: 'beef', reason: X509CertificateRevocationListEntryReason.CACompromise },
          { certificate: revokedLeaf },
        ],
      })

      expect(crl.revokedCount).toBe(2)

      const entryBySerial = crl.findRevoked(await createLeaf('beef'))
      expect(entryBySerial?.reason).toBe(X509CertificateRevocationListEntryReason.CACompromise)

      // The entry added via the certificate is found when looking up that certificate.
      expect(crl.findRevoked(revokedLeaf)).not.toBeNull()
    })

    it('produces a CRL that verifies against the issuer certificate', async () => {
      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        entries: [],
      })

      const result = await crl.verify({ issuerCertificate }, new CredoWebCrypto(agentContext))
      expect(result.isValid).toBe(true)
    })

    it('produces a CRL that fails verification when signed by a different key', async () => {
      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: otherIssuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        entries: [],
      })

      const result = await crl.verify({ issuerCertificate }, new CredoWebCrypto(agentContext))
      expect(result.isValid).toBe(false)
    })

    it('throws when an entry provides neither a serialNumber nor a certificate', async () => {
      await expect(
        X509Service.createCertificateRevocationList(agentContext, {
          authorityKey: issuerKey,
          issuer: issuerCertificate.subject,
          entries: [{ reason: X509CertificateRevocationListEntryReason.Superseded }],
        })
      ).rejects.toThrow(X509Error)
    })

    it('is reachable through X509Api', async () => {
      const api = agentContext.dependencyManager.resolve(X509Api)
      const crl = await api.createCertificateRevocationList({
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        entries: [{ serialNumber: 'abc' }],
      })

      expect(crl.issuer).toBe(issuerCertificate.subject)
      expect(crl.revokedCount).toBe(1)
    })

    it('includes the CRL Number and Authority Key Identifier extensions', async () => {
      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        extensions: {
          crlNumber: { value: 7 },
          authorityKeyIdentifier: { include: true },
        },
      })

      const parsed = new x509.X509Crl(crl.rawCertificateRevocationList)
      // CRL Number (2.5.29.20) and Authority Key Identifier (2.5.29.35).
      expect(parsed.getExtension('2.5.29.20')).not.toBeNull()
      expect(parsed.getExtension('2.5.29.35')).not.toBeNull()
    })

    it('includes a critical Issuing Distribution Point extension', async () => {
      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        extensions: {
          issuingDistributionPoint: {
            fullName: [CRL_URL],
            onlyContainsUserCerts: true,
            onlySomeReasons: [X509RevocationReason.KeyCompromise],
          },
        },
      })

      const parsed = new x509.X509Crl(crl.rawCertificateRevocationList)
      const idp = parsed.getExtension('2.5.29.28')
      expect(idp).not.toBeNull()
      // RFC 5280 §5.2.5: the IDP extension must be critical.
      expect(idp?.critical).toBe(true)
    })

    it('creates an indirect CRL with a per-entry certificateIssuer extension', async () => {
      const crl = await X509Service.createCertificateRevocationList(agentContext, {
        authorityKey: issuerKey,
        issuer: issuerCertificate.subject,
        validity: { thisUpdate: lastMonth, nextUpdate: nextMonth },
        extensions: { issuingDistributionPoint: { indirectCRL: true } },
        entries: [{ serialNumber: 'dd01', issuer: { commonName: 'Other CA' } }],
      })

      const parsed = new x509.X509Crl(crl.rawCertificateRevocationList)
      // The entry carries the certificateIssuer CRL entry extension (2.5.29.29).
      const entryExtension = parsed.entries[0].extensions.find((extension) => extension.type === '2.5.29.29')
      expect(entryExtension).toBeDefined()
      expect(entryExtension?.critical).toBe(true)
    })
  })
})
