import * as x509 from '@peculiar/x509'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { X509Certificate } from '../X509Certificate'
import { X509RevocationReason } from '../X509CrlDistributionPoint'
import { X509Error } from '../X509Error'
import { X509Service } from '../X509Service'
import { createP256Key, setupCrlAgent } from './x509CrlTestUtils'

const validity = {
  notBefore: new Date(Date.now() - 1000 * 60 * 60),
  notAfter: new Date(Date.now() + 1000 * 60 * 60),
}

describe('X509Certificate.crlDistributionPoints', () => {
  let agent: Agent
  let agentContext: AgentContext
  let kmsApi: KeyManagementApi
  let authorityKey: PublicJwk

  beforeAll(async () => {
    ;({ agent, agentContext, kmsApi } = await setupCrlAgent())
    authorityKey = await createP256Key(kmsApi)
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  async function createWithCrl(crlDistributionPoints?: {
    urls: string[]
    reasons?: X509RevocationReason[]
    crlIssuer?: string
  }) {
    return X509Service.createCertificate(agentContext, {
      issuer: { commonName: 'credo' },
      authorityKey,
      validity,
      extensions: crlDistributionPoints ? { crlDistributionPoints } : undefined,
    })
  }

  it('returns an empty array when there is no CRL extension', async () => {
    const certificate = await createWithCrl()
    expect(certificate.crlDistributionPoints).toEqual([])
  })

  it('parses a single full distribution point', async () => {
    const certificate = await createWithCrl({ urls: ['https://crl.example/full.crl'] })
    expect(certificate.crlDistributionPoints).toEqual([
      { urls: ['https://crl.example/full.crl'], reasons: undefined, crlIssuer: undefined },
    ])
  })

  it('parses multiple URLs (mirrors) within a single distribution point', async () => {
    const certificate = await createWithCrl({
      urls: ['https://a.example/full.crl', 'https://b.example/full.crl'],
    })

    expect(certificate.crlDistributionPoints).toHaveLength(1)
    expect(certificate.crlDistributionPoints[0].urls).toEqual([
      'https://a.example/full.crl',
      'https://b.example/full.crl',
    ])
  })

  it('round-trips revocation reasons through creation and parsing', async () => {
    const certificate = await createWithCrl({
      urls: ['https://crl.example/partitioned.crl'],
      reasons: [X509RevocationReason.KeyCompromise, X509RevocationReason.CACompromise],
    })

    expect(certificate.crlDistributionPoints).toHaveLength(1)
    expect(certificate.crlDistributionPoints[0].reasons).toEqual([
      X509RevocationReason.KeyCompromise,
      X509RevocationReason.CACompromise,
    ])
  })

  it('always reports crlIssuer as undefined even when present (indirect CRLs are not supported)', async () => {
    const certificate = await createWithCrl({
      urls: ['https://crl.example/indirect.crl'],
      crlIssuer: 'https://other-issuer.example',
    })

    expect(certificate.crlDistributionPoints).toHaveLength(1)
    expect(certificate.crlDistributionPoints[0].crlIssuer).toBeUndefined()
  })

  it('throws when there are multiple CRL Distribution Points extensions', async () => {
    // Build a raw certificate with two CRLDistributionPoints extensions.
    x509.cryptoProvider.set(new (await import('../../../crypto/webcrypto')).CredoWebCrypto(agentContext))
    try {
      const keys = await x509.cryptoProvider
        .get()
        .subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
      const raw = await x509.X509CertificateGenerator.createSelfSigned({
        name: 'CN=credo',
        keys,
        notBefore: validity.notBefore,
        notAfter: validity.notAfter,
        extensions: [
          new x509.CRLDistributionPointsExtension(['https://crl.example/one.crl']),
          new x509.CRLDistributionPointsExtension(['https://crl.example/two.crl']),
        ],
      })

      const certificate = X509Certificate.fromRawCertificate(new Uint8Array(raw.rawData))
      expect(() => certificate.crlDistributionPoints).toThrow(X509Error)
    } finally {
      x509.cryptoProvider.clear()
    }
  })
})
