import * as x509 from '@peculiar/x509'
import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import { CredoWebCrypto } from '../../../crypto/webcrypto'
import type { InMemoryLruCache } from '../../cache'
import type { KeyManagementApi, PublicJwk } from '../../kms'
import { X509ValidationError } from '../X509Error'
import { X509ModuleConfig } from '../X509ModuleConfig'
import { X509Service } from '../X509Service'
import { X509RevocationCheckMode } from '../X509ValidationOptions'
import { createP256Key, generateCrl, mockCrl, mockCrlNetworkError, setupCrlAgent } from './x509CrlTestUtils'

const LEAF_CRL_URL = 'https://crl.example/leaf.crl'
const INTERMEDIATE_CRL_URL = 'https://crl.example/intermediate.crl'

const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

describe('X509Service revocation (end-to-end)', () => {
  let agent: Agent
  let agentContext: AgentContext
  let kmsApi: KeyManagementApi
  let cache: InMemoryLruCache

  let rootKey: PublicJwk
  let intermediateKey: PublicJwk
  let rootSubject: string
  let intermediateSubject: string
  let leafSerial: string
  let intermediateSerial: string
  let certificateChain: string[]

  function setMode(mode: X509RevocationCheckMode, checkFullChain = true) {
    agentContext.dependencyManager.resolve(X509ModuleConfig).setRevocationCheck({ mode, checkFullChain })
  }

  beforeAll(async () => {
    ;({ agent, agentContext, kmsApi, cache } = await setupCrlAgent({
      revocationCheck: { mode: X509RevocationCheckMode.Disabled },
    }))

    rootKey = await createP256Key(kmsApi)
    intermediateKey = await createP256Key(kmsApi)
    const leafKey = await createP256Key(kmsApi)

    x509.cryptoProvider.set(new CredoWebCrypto(agentContext))

    const rootCert = await X509Service.createCertificate(agentContext, {
      serialNumber: '01',
      issuer: { commonName: 'Root' },
      authorityKey: rootKey,
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: { basicConstraints: { ca: true, pathLenConstraint: 2 } },
    })
    rootSubject = rootCert.subject

    intermediateSerial = '02'
    const intermediateCert = await X509Service.createCertificate(agentContext, {
      serialNumber: intermediateSerial,
      issuer: rootCert.subject,
      authorityKey: rootKey,
      subject: { commonName: 'Intermediate' },
      subjectPublicKey: intermediateKey,
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: {
        basicConstraints: { ca: true, pathLenConstraint: 1 },
        crlDistributionPoints: { urls: [INTERMEDIATE_CRL_URL] },
      },
    })
    intermediateSubject = intermediateCert.subject

    leafSerial = '03'
    const leafCert = await X509Service.createCertificate(agentContext, {
      serialNumber: leafSerial,
      issuer: intermediateCert.subject,
      authorityKey: intermediateKey,
      subject: { commonName: 'Leaf' },
      subjectPublicKey: leafKey,
      validity: { notBefore: lastMonth, notAfter: nextMonth },
      extensions: { crlDistributionPoints: { urls: [LEAF_CRL_URL] } },
    })

    const builder = new x509.X509ChainBuilder({
      certificates: [
        new x509.X509Certificate(rootCert.rawCertificate),
        new x509.X509Certificate(intermediateCert.rawCertificate),
      ],
    })
    certificateChain = (await builder.build(new x509.X509Certificate(leafCert.rawCertificate))).map((c) =>
      c.toString('base64')
    )

    x509.cryptoProvider.clear()
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

  /** DER bytes of a CRL signed by the intermediate, covering the leaf. */
  async function leafCrlBytes(revokedSerials: string[] = [], nextUpdate = nextMonth, thisUpdate = lastMonth) {
    return generateCrl(agentContext, {
      issuerName: intermediateSubject,
      issuerKey: intermediateKey,
      thisUpdate,
      nextUpdate,
      entries: revokedSerials.map((serialNumber) => ({ serialNumber, revocationDate: lastMonth })),
    })
  }

  /** DER bytes of a CRL signed by the root, covering the intermediate. */
  async function intermediateCrlBytes(revokedSerials: string[] = []) {
    return generateCrl(agentContext, {
      issuerName: rootSubject,
      issuerKey: rootKey,
      thisUpdate: lastMonth,
      nextUpdate: nextMonth,
      entries: revokedSerials.map((serialNumber) => ({ serialNumber, revocationDate: lastMonth })),
    })
  }

  it('skips revocation checking when disabled', async () => {
    setMode(X509RevocationCheckMode.Disabled)
    // Even though the leaf would be revoked, disabled mode never fetches.
    const scope = mockCrl(LEAF_CRL_URL, await leafCrlBytes([leafSerial]))

    const chain = await X509Service.validateCertificateChain(agentContext, { certificateChain })
    expect(chain).toHaveLength(3)
    expect(scope.isDone()).toBe(false)
  })

  it('validates the chain when the leaf is not revoked (SoftFail)', async () => {
    setMode(X509RevocationCheckMode.SoftFail)
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([]))
    const scope = mockCrl(LEAF_CRL_URL, await leafCrlBytes([]))

    const chain = await X509Service.validateCertificateChain(agentContext, { certificateChain })
    expect(chain).toHaveLength(3)
    expect(scope.isDone()).toBe(true)
  })

  it('rejects the chain when the leaf is revoked (Require)', async () => {
    setMode(X509RevocationCheckMode.Require)
    // Verified CRLs are cached after the first validation, so a single interceptor each covers both
    // calls. The intermediate is checked first (and not revoked), then the revoked leaf fails.
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([]))
    mockCrl(LEAF_CRL_URL, await leafCrlBytes([leafSerial]))

    await expect(X509Service.validateCertificateChain(agentContext, { certificateChain })).rejects.toThrow(
      X509ValidationError
    )

    try {
      await X509Service.validateCertificateChain(agentContext, { certificateChain })
    } catch (error) {
      expect(error).toBeInstanceOf(X509ValidationError)
      expect((error as X509ValidationError).validationResult.validations.revocationStatus?.isValid).toBe(false)
    }
  })

  it('rejects a revoked leaf even in SoftFail mode', async () => {
    setMode(X509RevocationCheckMode.SoftFail)
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([]))
    mockCrl(LEAF_CRL_URL, await leafCrlBytes([leafSerial]))

    await expect(X509Service.validateCertificateChain(agentContext, { certificateChain })).rejects.toThrow(
      X509ValidationError
    )
  })

  it('passes on network failure in SoftFail but fails in Require', async () => {
    // The intermediate is reachable and not revoked (cached after the first validation); the leaf
    // CRL fails with a network error. A failed fetch is not cached, so both validations re-fetch it.
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([]))
    mockCrlNetworkError(LEAF_CRL_URL, { times: 2 })

    setMode(X509RevocationCheckMode.SoftFail)
    const chain = await X509Service.validateCertificateChain(agentContext, { certificateChain })
    expect(chain).toHaveLength(3)

    setMode(X509RevocationCheckMode.Require)
    await expect(X509Service.validateCertificateChain(agentContext, { certificateChain })).rejects.toThrow(
      X509ValidationError
    )
  })

  it('checks the intermediate certificate when checkFullChain is enabled', async () => {
    setMode(X509RevocationCheckMode.Require, true)
    mockCrl(LEAF_CRL_URL, await leafCrlBytes([]))
    // The intermediate is revoked in the root-issued CRL.
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([intermediateSerial]))

    await expect(X509Service.validateCertificateChain(agentContext, { certificateChain })).rejects.toThrow(
      X509ValidationError
    )
  })

  it('validates the full chain when neither leaf nor intermediate are revoked', async () => {
    setMode(X509RevocationCheckMode.Require, true)
    mockCrl(LEAF_CRL_URL, await leafCrlBytes([]))
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([]))

    const chain = await X509Service.validateCertificateChain(agentContext, { certificateChain })
    expect(chain).toHaveLength(3)
  })

  it('rejects an expired CRL in Require mode (verificationDate defaults to now)', async () => {
    setMode(X509RevocationCheckMode.Require)
    // The intermediate CRL is valid; the leaf CRL is expired and must fail.
    mockCrl(INTERMEDIATE_CRL_URL, await intermediateCrlBytes([]))
    mockCrl(LEAF_CRL_URL, await leafCrlBytes([], lastMonth, twoMonthsAgo))

    await expect(X509Service.validateCertificateChain(agentContext, { certificateChain })).rejects.toThrow(
      X509ValidationError
    )
  })
})
