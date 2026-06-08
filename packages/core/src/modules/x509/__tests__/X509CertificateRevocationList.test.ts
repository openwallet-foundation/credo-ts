import * as x509 from '@peculiar/x509'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import { CredoWebCrypto } from '../../../crypto/webcrypto'
import { TypedArrayEncoder } from '../../../utils'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { X509Certificate } from '../X509Certificate'
import { X509CertificateRevocationList } from '../X509CertificateRevocationList'
import { X509Error } from '../X509Error'
import { X509Service } from '../X509Service'
import { createP256Key, generateCrl, setupCrlAgent } from './x509CrlTestUtils'

describe('X509CertificateRevocationList', () => {
  let agent: Agent
  let agentContext: AgentContext
  let kmsApi: KeyManagementApi

  let issuerKey: PublicJwk
  let issuerCertificate: X509Certificate
  let otherCertificate: X509Certificate

  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // A revoked serial with a leading zero to make sure serial-number formats are normalized.
  const revokedSerial = '0a1b2c'

  let crlBytes: Uint8Array

  beforeAll(async () => {
    ;({ agent, agentContext, kmsApi } = await setupCrlAgent())

    issuerKey = await createP256Key(kmsApi)
    const otherKey = await createP256Key(kmsApi)

    issuerCertificate = await X509Service.createCertificate(agentContext, {
      serialNumber: '01',
      issuer: { commonName: 'CRL Issuer' },
      authorityKey: issuerKey,
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: { basicConstraints: { ca: true } },
    })

    otherCertificate = await X509Service.createCertificate(agentContext, {
      serialNumber: '02',
      issuer: { commonName: 'Other Issuer' },
      authorityKey: otherKey,
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: { basicConstraints: { ca: true } },
    })

    crlBytes = await generateCrl(agentContext, {
      issuerName: issuerCertificate.subject,
      issuerKey,
      thisUpdate: lastMonth,
      nextUpdate: nextMonth,
      entries: [
        { serialNumber: revokedSerial, revocationDate: lastMonth, reason: x509.X509CrlReason.keyCompromise },
        { serialNumber: 'ff', revocationDate: lastMonth },
      ],
    })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  it('parses a CRL from raw DER bytes', () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    expect(crl.issuer).toContain('CRL Issuer')
  })

  it('throws an X509Error when parsing invalid raw bytes', () => {
    expect(() => X509CertificateRevocationList.fromRaw(new Uint8Array([1, 2, 3, 4]))).toThrow(X509Error)
  })

  it('parses a CRL from a PEM and base64 string', () => {
    const pem = X509CertificateRevocationList.fromRaw(crlBytes).toString('pem')
    expect(X509CertificateRevocationList.fromEncoded(pem).issuer).toContain('CRL Issuer')

    const base64 = TypedArrayEncoder.toBase64(crlBytes)
    expect(X509CertificateRevocationList.fromEncoded(base64).issuer).toContain('CRL Issuer')
  })

  it('throws an X509Error when parsing an invalid encoded CRL', () => {
    expect(() => X509CertificateRevocationList.fromEncoded('not-a-crl')).toThrow(X509Error)
  })

  it('exposes thisUpdate and nextUpdate', () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    // CRL dates are encoded at one-second resolution, so compare at second granularity.
    expect(Math.floor(crl.thisUpdate.getTime() / 1000)).toBe(Math.floor(lastMonth.getTime() / 1000))
    expect(Math.floor((crl.nextUpdate?.getTime() ?? 0) / 1000)).toBe(Math.floor(nextMonth.getTime() / 1000))
  })

  it('reports expiry relative to nextUpdate', async () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    expect(crl.isExpired(new Date(nextMonth.getTime() + 1000))).toBe(true)
    expect(crl.isExpired(lastMonth)).toBe(false)

    const noNextUpdate = await generateCrl(agentContext, {
      issuerName: issuerCertificate.subject,
      issuerKey,
      thisUpdate: lastMonth,
    })
    expect(X509CertificateRevocationList.fromRaw(noNextUpdate).isExpired(nextMonth)).toBe(false)
  })

  it('reports whether the CRL is not yet valid (before thisUpdate)', async () => {
    const futureNextUpdate = new Date(nextMonth.getTime() + 30 * 24 * 60 * 60 * 1000)
    const futureCrl = X509CertificateRevocationList.fromRaw(
      await generateCrl(agentContext, {
        issuerName: issuerCertificate.subject,
        issuerKey,
        thisUpdate: nextMonth,
        nextUpdate: futureNextUpdate,
      })
    )

    expect(futureCrl.isNotYetValid(new Date())).toBe(true)
    expect(futureCrl.isNotYetValid(new Date(nextMonth.getTime() + 1000))).toBe(false)

    // The fixture CRL (thisUpdate in the past) is already valid.
    expect(X509CertificateRevocationList.fromRaw(crlBytes).isNotYetValid()).toBe(false)
  })

  it('verifies the CRL against the correct issuer', async () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    const result = await crl.verify({ issuerCertificate }, new CredoWebCrypto(agentContext))
    expect(result.isValid).toBe(true)
  })

  it('fails verification against the wrong issuer', async () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    const result = await crl.verify({ issuerCertificate: otherCertificate }, new CredoWebCrypto(agentContext))
    expect(result.isValid).toBe(false)
    expect(result.error).toBeInstanceOf(X509Error)
  })

  it('finds a revoked certificate (normalizing serial number formats)', async () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)

    const revokedCert = await X509Service.createCertificate(agentContext, {
      serialNumber: revokedSerial,
      issuer: issuerCertificate.subject,
      authorityKey: issuerKey,
      subject: { commonName: 'Revoked Leaf' },
      subjectPublicKey: await createP256Key(kmsApi),
      validity: { notBefore: lastMonth, notAfter: nextMonth },
    })

    const entry = crl.findRevoked(revokedCert)
    expect(entry).not.toBeNull()
    expect(entry?.reason).toBe(x509.X509CrlReason.keyCompromise)
  })

  it('returns null for a certificate that is not revoked', async () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)

    const validCert = await X509Service.createCertificate(agentContext, {
      serialNumber: 'abcdef',
      issuer: issuerCertificate.subject,
      authorityKey: issuerKey,
      subject: { commonName: 'Valid Leaf' },
      subjectPublicKey: await createP256Key(kmsApi),
      validity: { notBefore: lastMonth, notAfter: nextMonth },
    })

    expect(crl.findRevoked(validCert)).toBeNull()
  })

  it('lists all revoked certificates', () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    expect(crl.revokedCount).toBe(2)
    const serials = crl.revokedCertificates.map((c) => c.serialNumber.toLowerCase())
    expect(serials).toContain(revokedSerial)
  })

  it('compares two CRLs for equality', () => {
    const crl = X509CertificateRevocationList.fromRaw(crlBytes)
    const same = X509CertificateRevocationList.fromRaw(crlBytes)
    expect(crl.equal(same)).toBe(true)
  })
})
