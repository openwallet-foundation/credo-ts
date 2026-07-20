import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { buildCrlSummary, CrlSummaryVerifiedCrl, isX509CrlSummary } from '../utils/crlSummary'
import type { X509Certificate } from '../X509Certificate'
import {
  type X509CertificateRevocationList,
  X509CertificateRevocationListEntryReason,
} from '../X509CertificateRevocationList'
import { X509RevocationReason } from '../X509CrlDistributionPoint'
import { X509Service } from '../X509Service'
import type { X509CreateCertificateRevocationListOptions } from '../X509ServiceOptions'
import { createP256Key, setupCrlAgent } from './x509CrlTestUtils'

const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

describe('crlSummary', () => {
  let agent: Agent
  let agentContext: AgentContext
  let kmsApi: KeyManagementApi

  let issuerKey: PublicJwk
  let issuerCertificate: X509Certificate

  beforeAll(async () => {
    ;({ agent, agentContext, kmsApi } = await setupCrlAgent())

    issuerKey = await createP256Key(kmsApi)
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

  async function createCrl(options: {
    entries?: X509CreateCertificateRevocationListOptions['entries']
    extensions?: X509CreateCertificateRevocationListOptions['extensions']
    nextUpdate?: Date
  }): Promise<X509CertificateRevocationList> {
    return X509Service.createCertificateRevocationList(agentContext, {
      authorityKey: issuerKey,
      issuer: issuerCertificate.subject,
      validity: { thisUpdate: lastMonth, nextUpdate: options.nextUpdate ?? nextMonth },
      entries: options.entries,
      extensions: options.extensions,
    })
  }

  async function createLeaf(serialNumber: string): Promise<X509Certificate> {
    return X509Service.createCertificate(agentContext, {
      serialNumber,
      issuer: issuerCertificate.subject,
      authorityKey: issuerKey,
      subject: { commonName: `Leaf ${serialNumber}` },
      subjectPublicKey: await createP256Key(kmsApi),
      validity: { notBefore: lastMonth, notAfter: nextMonth },
    })
  }

  function summaryFor(crl: X509CertificateRevocationList) {
    return buildCrlSummary(crl, issuerCertificate)
  }

  it('builds a summary that survives a JSON round-trip', async () => {
    const crl = await createCrl({
      entries: [
        {
          serialNumber: 'a1',
          revocationDate: twoMonthsAgo,
          reason: X509CertificateRevocationListEntryReason.KeyCompromise,
        },
        { serialNumber: 'b2', revocationDate: lastMonth },
      ],
      extensions: {
        issuingDistributionPoint: {
          fullName: ['https://crl.example/scoped.crl'],
          onlyContainsUserCerts: true,
          onlySomeReasons: [X509RevocationReason.KeyCompromise, X509RevocationReason.Superseded],
        },
      },
    })

    const summary = summaryFor(crl)
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary)
  })

  describe('CrlSummaryVerifiedCrl', () => {
    it('matches findRevoked of the parsed CRL, including serial normalization', async () => {
      const crl = await createCrl({
        entries: [
          {
            serialNumber: 'ab',
            revocationDate: twoMonthsAgo,
            reason: X509CertificateRevocationListEntryReason.KeyCompromise,
          },
          { serialNumber: 'c3', revocationDate: lastMonth },
        ],
      })
      const view = new CrlSummaryVerifiedCrl(summaryFor(crl))

      // Certificate serial '00ab' matches CRL entry 'ab' via normalization
      for (const serialNumber of ['00ab', 'c3', 'dead']) {
        const certificate = await createLeaf(serialNumber)
        expect(view.findRevoked(certificate)).toEqual(crl.findRevoked(certificate))
      }
    })

    it('returns the first matching entry for duplicate serials, like the linear scan of the parsed CRL', async () => {
      // The CRL generator rejects duplicate serials, so exercise the lookup index directly with a
      // hand-built summary containing entries that normalize to the same serial.
      const view = new CrlSummaryVerifiedCrl({
        issuerNameSha256: 'ab'.repeat(32),
        issuerPublicJwkThumbprint: 'cd'.repeat(32),
        thisUpdate: lastMonth.getTime(),
        criticalExtensionIds: [],
        serialNumbers: ['00C3', 'c3'],
        revocationDates: [twoMonthsAgo.getTime(), lastMonth.getTime()],
        reasons: [X509CertificateRevocationListEntryReason.KeyCompromise, null],
      })

      expect(view.findRevoked(await createLeaf('c3'))).toEqual({
        serialNumber: '00C3',
        revocationDate: new Date(twoMonthsAgo.getTime()),
        reason: X509CertificateRevocationListEntryReason.KeyCompromise,
      })
    })

    it('exposes the same applicability data as the parsed CRL', async () => {
      const deltaCrl = await createCrl({ extensions: { deltaCrlIndicator: { value: 5 } } })
      const idpCrl = await createCrl({
        extensions: {
          issuingDistributionPoint: { fullName: ['https://crl.example/full.crl'], onlyContainsCACerts: true },
        },
      })
      const criticalCrlNumberCrl = await createCrl({ extensions: { crlNumber: { value: 1, markAsCritical: true } } })

      for (const crl of [deltaCrl, idpCrl, criticalCrlNumberCrl]) {
        const view = new CrlSummaryVerifiedCrl(summaryFor(crl))
        expect(view.deltaCrlIndicator).toEqual(crl.deltaCrlIndicator)
        expect(view.issuingDistributionPoint).toEqual(crl.issuingDistributionPoint)
        expect(view.criticalExtensionIds).toEqual(crl.criticalExtensionIds)
      }
    })
  })

  describe('isX509CrlSummary', () => {
    it('accepts summaries built from a CRL', async () => {
      const plainCrl = await createCrl({ entries: [{ serialNumber: 'a1', revocationDate: lastMonth }] })
      expect(isX509CrlSummary(summaryFor(plainCrl))).toBe(true)

      const richCrl = await createCrl({
        extensions: { issuingDistributionPoint: { indirectCRL: true } },
      })
      // Also after a serialization round-trip, as returned by persistent caches
      expect(isX509CrlSummary(JSON.parse(JSON.stringify(summaryFor(richCrl))))).toBe(true)
    })

    it('rejects values that are not a valid summary', async () => {
      const crl = await createCrl({ entries: [{ serialNumber: 'a1', revocationDate: lastMonth }] })
      const summary = summaryFor(crl)

      expect(isX509CrlSummary(null)).toBe(false)
      expect(isX509CrlSummary('garbage')).toBe(false)
      expect(isX509CrlSummary({})).toBe(false)
      expect(isX509CrlSummary({ ...summary, thisUpdate: 'not a number' })).toBe(false)
      expect(isX509CrlSummary({ ...summary, serialNumbers: [1] })).toBe(false)
      // Mismatched parallel array lengths
      expect(isX509CrlSummary({ ...summary, revocationDates: [] })).toBe(false)
    })
  })
})
