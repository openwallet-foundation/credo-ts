import {
  DidKey,
  getDomainFromUrl,
  TypedArrayEncoder,
  X509Certificate,
  X509ModuleConfig,
  X509Service,
} from '@credo-ts/core'
import nock from 'nock'
import { vi } from 'vitest'
import { PublicJwk } from '../../kms'
import type { SdJwtVcPayload } from '../SdJwtVcOptions'
import { createHolderBindingTestSetup } from './holderBindingTestSetup'
import { funkeX509, simpleJwtVc, simpleSdJwtVcWithStatus, simpleX509, simpleX509WithoutIss } from './sdjwtvc.fixtures'
import { generateStatusList, generateX509StatusList } from './statusListTestUtils'

describe('SdJwtVcService issuer signing and trust', () => {
  let setup: Awaited<ReturnType<typeof createHolderBindingTestSetup>>
  let agent: typeof setup.agent
  let sdJwtVcService: typeof setup.service
  let issuerDidUrl: string
  let issuerKey: PublicJwk
  let holderKey: PublicJwk
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'
  const simpleX509Certificate = X509Certificate.fromEncodedCertificate(simpleX509.trustedCertificate)

  const mockStatusList = (statusList: string) =>
    nock('https://example.com')
      .get('/status-list')
      .matchHeader('accept', 'application/statuslist+jwt')
      .reply(200, statusList, { 'Content-Type': 'application/statuslist+jwt' })

  beforeAll(async () => {
    setup = await createHolderBindingTestSetup('sdjwtvc-issuer')
    agent = setup.agent
    sdJwtVcService = setup.service
    issuerDidUrl = setup.issuer.didUrl
    issuerKey = setup.issuer.key
    holderKey = setup.holder.key
    simpleX509Certificate.keyId = issuerKey.keyId
    agent.kms.randomBytes = vi.fn(() => TypedArrayEncoder.fromUtf8String('salt'))
    Date.prototype.getTime = vi.fn(() => 1698151532 * 1000)
    Date.now = vi.fn(() => 1698151532 * 1000)
  })

  afterEach(() => {
    nock.cleanAll()
    vi.restoreAllMocks()
  })

  test('Verify x509 protected sd-jwt-vc without disclosures', async () => {
    const presentation = await sdJwtVcService.present(agent.context, {
      sdJwtVc: simpleX509.sdJwtVc,
      // no disclosures
      presentationFrame: {},
      verifierMetadata: {
        issuedAt: Date.now() / 1000,
        audience: verifierDid,
        nonce: 'salt',
      },
    })

    const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
    x509ModuleConfig.addTrustedCertificate(simpleX509.trustedCertificate)

    const verificationResult = await sdJwtVcService.verify(agent.context, {
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierDid, nonce: 'salt' },
      requiredClaimKeys: ['claim'],
    })

    expect(verificationResult).toEqual({
      isValid: true,
      sdJwtVc: expect.any(Object),
    })
  })

  test('Verify x509 protected sd-jwt-vc without iss', async () => {
    const presentation = await sdJwtVcService.present(agent.context, {
      sdJwtVc: simpleX509WithoutIss.sdJwtVc,
      // no disclosures
      presentationFrame: {},
      verifierMetadata: {
        issuedAt: Date.now() / 1000,
        audience: verifierDid,
        nonce: 'salt',
      },
    })

    const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
    x509ModuleConfig.addTrustedCertificate(simpleX509WithoutIss.trustedCertificate)

    const verificationResult = await sdJwtVcService.verify(agent.context, {
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierDid, nonce: 'salt' },
      requiredClaimKeys: ['claim'],
    })

    expect(verificationResult).toEqual({
      isValid: true,
      sdJwtVc: expect.any(Object),
    })
  })

  test('Verify x509 chain protected sd-jwt-vc', async () => {
    const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
    x509ModuleConfig.addTrustedCertificate(funkeX509.trustedCertificate)

    Date.prototype.getTime = vi.fn(function () {
      return 1717498204 * 1000
    })
    Date.now = vi.fn(function () {
      return 1717498204 * 1000
    })

    const verificationResult = await sdJwtVcService.verify(agent.context, {
      compactSdJwtVc: funkeX509.sdJwtVc,
      requiredClaimKeys: ['issuing_country'],
    })

    Date.prototype.getTime = vi.fn(function () {
      return 1698151532000
    })
    Date.now = vi.fn(function () {
      return 1698151532000
    })

    const sdJwtIss = verificationResult.sdJwtVc?.payload.iss
    expect(sdJwtIss).toEqual('https://demo.pid-issuer.bundesdruckerei.de/c')
    expect(getDomainFromUrl(sdJwtIss as string)).toEqual('demo.pid-issuer.bundesdruckerei.de')

    expect(verificationResult).toEqual({
      isValid: true,
      sdJwtVc: expect.any(Object),
    })
  })

  test('does not sign as an issuer for an unregistered DID even if its key exists in KMS', async () => {
    const key = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const didUrl = new DidKey(PublicJwk.fromUnknown(key.publicJwk)).didDocument.verificationMethod?.[0]?.id
    if (!didUrl) throw new Error('Expected a DID verification method')

    // Deliberately do not call agent.dids.import: the key exists in KMS, but no created-DID record maps it to this DID.
    await expect(
      sdJwtVcService.sign(agent.context, {
        payload: { claim: 'some-claim', vct: 'IdentityCredential' },
        issuer: { method: 'did', didUrl },
      })
    ).rejects.toThrow('not found')
  })

  describe('SdJwtVcService.verify with getTrustedIssuersForVerification', () => {
    const presentDid = () =>
      sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleJwtVc,
        presentationFrame: {},
        verifierMetadata: { issuedAt: Date.now() / 1000, audience: verifierDid, nonce: 'salt' },
      })

    const presentX509 = () =>
      sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleX509.sdJwtVc,
        presentationFrame: {},
        verifierMetadata: { issuedAt: Date.now() / 1000, audience: verifierDid, nonce: 'salt' },
      })

    afterEach(() => {
      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
      agent.context.config.setTrustedIssuersForVerification(undefined)
      x509ModuleConfig.setTrustedCertificatesForVerification(undefined)
      x509ModuleConfig.setTrustedCertificates(undefined)
    })

    test('did issuer is accepted when returned as a trusted issuer', async () => {
      const presentation = await presentDid()
      const issuerDid = issuerDidUrl.split('#')[0]
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'did', issuance: issuerDid }],
      }))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('did issuer is rejected when not in the trusted issuers', async () => {
      const presentation = await presentDid()
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [
          { method: 'did', issuance: 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y' },
        ],
      }))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(false)
      if (!verificationResult.isValid) {
        expect(verificationResult.error?.message).toContain('is not trusted')
      }
    })

    test('x509 issuer is accepted when its certificate is returned as a trusted issuer', async () => {
      const presentation = await presentX509()
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'x509', issuance: [simpleX509.trustedCertificate] }],
      }))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('x509 issuer is rejected when a different certificate is trusted', async () => {
      const presentation = await presentX509()
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'x509', issuance: [funkeX509.trustedCertificate] }],
      }))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(false)
    })

    test('returning an empty trusted issuers array hard-rejects an x509 issuer', async () => {
      const presentation = await presentX509()
      agent.context.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(false)
    })

    test('the generic callback takes precedence over the deprecated x509 callback', async () => {
      const presentation = await presentX509()

      // Deprecated x509 callback would trust the correct certificate...
      agent.context.dependencyManager
        .resolve(X509ModuleConfig)
        .setTrustedCertificatesForVerification(async () => [simpleX509.trustedCertificate])
      // ...but the generic callback takes precedence and trusts a different certificate.
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'x509', issuance: [funkeX509.trustedCertificate] }],
      }))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(false)
    })

    test('did issuer is allowed by default when no trusted issuers are configured', async () => {
      const presentation = await presentDid()

      // No `getTrustedIssuersForVerification` callback set: did issuers remain allowed by default,
      // preserving the pre-existing (v0.7.0) behavior.
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('falls back to the deprecated x509 callback when no generic callback is set', async () => {
      const presentation = await presentX509()
      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
      x509ModuleConfig.setTrustedCertificates(undefined)

      // Only the deprecated x509 callback is configured (no generic callback): it must still gate
      // verification, exactly as in v0.7.0.
      x509ModuleConfig.setTrustedCertificatesForVerification(async () => [simpleX509.trustedCertificate])

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('falls back to statically configured trusted certificates when no callback is set', async () => {
      const presentation = await presentX509()
      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)

      // Neither callback configured: the static `trustedCertificates` list is the final fallback.
      x509ModuleConfig.setTrustedCertificates([simpleX509.trustedCertificate])

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult.isValid).toBe(true)
    })
  })

  describe('SdJwtVcService.verify status list against the matched trusted issuer', () => {
    const issuerDid = () => issuerDidUrl.split('#')[0]

    const createSigningCertificate = async (commonName: string) => {
      const key = PublicJwk.fromPublicJwk((await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
      const certificate = await X509Service.createCertificate(agent.context, {
        authorityKey: key,
        issuer: { commonName },
        validity: { notBefore: new Date('2020-01-01'), notAfter: new Date('2035-01-01') },
      })
      certificate.keyId = key.keyId
      return { key, certificate }
    }

    const signX509CredentialWithStatus = async (certificate: X509Certificate) => {
      const signed = await sdJwtVcService.sign(agent.context, {
        payload: {
          vct: 'IdentityCredential',
          claim: 'some-claim',
          status: { status_list: { idx: 12, uri: 'https://example.com/status-list' } },
        } as SdJwtVcPayload,
        issuer: { method: 'x5c', x5c: [certificate] },
      })

      return sdJwtVcService.present(agent.context, { sdJwtVc: signed, presentationFrame: {} })
    }

    afterEach(() => {
      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
      agent.context.config.setTrustedIssuersForVerification(undefined)
      x509ModuleConfig.setTrustedCertificatesForVerification(undefined)
      x509ModuleConfig.setTrustedCertificates(undefined)
    })

    test('did: status list signed by the trusted issuer did is accepted', async () => {
      mockStatusList(await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, []))

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleSdJwtVcWithStatus,
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [{ method: 'did', issuance: issuerDid() }],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('did: status list signed by a different did is rejected', async () => {
      const otherKey = PublicJwk.fromPublicJwk(
        (await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      )
      const otherDidDocument = new DidKey(otherKey).didDocument
      const otherDidUrl = (otherDidDocument.verificationMethod ?? [])[0].id
      await agent.dids.import({
        didDocument: otherDidDocument,
        did: otherDidDocument.id,
        keys: [{ didDocumentRelativeKeyId: `#${otherDidUrl.split('#')[1]}`, kmsKeyId: otherKey.keyId }],
      })

      mockStatusList(await generateStatusList(agent.context, otherKey, otherDidUrl, 24, []))

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleSdJwtVcWithStatus,
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [{ method: 'did', issuance: issuerDid() }],
      })

      expect(verificationResult.isValid).toBe(false)
      if (!verificationResult.isValid) {
        expect(verificationResult.error?.message).toContain('Status List JWT verification failed')
      }
    })

    test('status validation can be disabled even when the credential is revoked', async () => {
      mockStatusList(await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [12]))

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleSdJwtVcWithStatus,
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [{ method: 'did', issuance: issuerDid() }],
        disableStatusValidation: true,
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('x509: status list signed by a dedicated trusted status certificate is accepted', async () => {
      const issuance = await createSigningCertificate('Issuance')
      const status = await createSigningCertificate('Status')

      const presentation = await signX509CredentialWithStatus(issuance.certificate)
      mockStatusList(await generateX509StatusList(agent.context, status.key, status.certificate, 24, []))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [
          {
            method: 'x509',
            issuance: [issuance.certificate.toString('base64')],
            status: [status.certificate.toString('base64')],
          },
        ],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('x509: status list signed by a certificate not in the status certificates is rejected', async () => {
      const issuance = await createSigningCertificate('Issuance')
      const status = await createSigningCertificate('Status')

      const presentation = await signX509CredentialWithStatus(issuance.certificate)
      mockStatusList(await generateX509StatusList(agent.context, status.key, status.certificate, 24, []))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [
          {
            method: 'x509',
            issuance: [issuance.certificate.toString('base64')],
            // Status list is signed by `status`, but only `issuance` is trusted to sign status lists.
            status: [issuance.certificate.toString('base64')],
          },
        ],
      })

      expect(verificationResult.isValid).toBe(false)
      if (!verificationResult.isValid) {
        expect(verificationResult.error?.message).toContain('Status List JWT verification failed')
      }
    })

    test('x509: falls back to the issuance certificates when no status certificates are configured', async () => {
      const issuance = await createSigningCertificate('Issuance')

      const presentation = await signX509CredentialWithStatus(issuance.certificate)
      // Status list is signed by the issuance certificate (same as the credential signer).
      mockStatusList(await generateX509StatusList(agent.context, issuance.key, issuance.certificate, 24, []))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [{ method: 'x509', issuance: [issuance.certificate.toString('base64')] }],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('x509: falls back to issuance certs for a leaf-under-root chain when no status certs are configured', async () => {
      const rootKey = PublicJwk.fromPublicJwk(
        (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      )
      const leafKey = PublicJwk.fromPublicJwk(
        (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      )

      const rootCertificate = await X509Service.createCertificate(agent.context, {
        authorityKey: rootKey,
        issuer: { commonName: 'Root' },
        validity: { notBefore: new Date('2020-01-01'), notAfter: new Date('2035-01-01') },
        extensions: { basicConstraints: { ca: true } },
      })
      rootCertificate.keyId = rootKey.keyId

      const leafCertificate = await X509Service.createCertificate(agent.context, {
        authorityKey: rootKey,
        subjectPublicKey: leafKey,
        issuer: { commonName: 'Root' },
        subject: { commonName: 'Leaf' },
        validity: { notBefore: new Date('2020-01-01'), notAfter: new Date('2035-01-01') },
      })
      leafCertificate.keyId = leafKey.keyId

      const presentation = await signX509CredentialWithStatus(leafCertificate)
      // Status list is signed by the same leaf as the credential.
      mockStatusList(await generateX509StatusList(agent.context, leafKey, leafCertificate, 24, []))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [{ method: 'x509', issuance: [rootCertificate.toString('base64')] }],
      })

      expect(verificationResult.isValid).toBe(true)
    })

    test('x509: an empty status certificates array rejects any status list', async () => {
      const issuance = await createSigningCertificate('Issuance')

      const presentation = await signX509CredentialWithStatus(issuance.certificate)
      mockStatusList(await generateX509StatusList(agent.context, issuance.key, issuance.certificate, 24, []))

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        trustedIssuers: [{ method: 'x509', issuance: [issuance.certificate.toString('base64')], status: [] }],
      })

      expect(verificationResult.isValid).toBe(false)
      if (!verificationResult.isValid) {
        expect(verificationResult.error?.message).toContain('Status List JWT verification failed')
      }
    })
  })

  test('Sign (x509) sd-jwt-vc with an invalid certificate issuer should fail', async () => {
    await expect(
      sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'x5c',
          x5c: [simpleX509Certificate],
          issuer: 'some-issuer',
        },
      })
    ).rejects.toThrow()
  })

  test('Sign (x509) sd-jwt-vc from a basic payload without disclosures', async () => {
    const { compact } = await sdJwtVcService.sign(agent.context, {
      payload: {
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
      },
      holder: {
        method: 'jwk',
        jwk: holderKey,
      },
      issuer: {
        method: 'x5c',
        x5c: [simpleX509Certificate],
        issuer: simpleX509.certificateIssuer,
      },
      headerType: 'vc+sd-jwt',
    })

    expect(compact).toStrictEqual(simpleX509.sdJwtVc)

    const sdJwtVc = sdJwtVcService.fromCompact(compact)
    expect(sdJwtVc.header).toEqual({
      typ: 'vc+sd-jwt',
      alg: 'EdDSA',
      x5c: [simpleX509.trustedCertificate],
    })

    expect(sdJwtVc.prettyClaims).toEqual({
      claim: 'some-claim',
      vct: 'IdentityCredential',
      iat: Math.floor(Date.now() / 1000),
      iss: simpleX509.certificateIssuer,
      cnf: { jwk: holderKey.toJson() },
    })
  })

  test('Sign (x509) sd-jwt-vc without issuer claim', async () => {
    const { compact } = await sdJwtVcService.sign(agent.context, {
      payload: {
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
      },
      holder: {
        method: 'jwk',
        jwk: holderKey,
      },
      issuer: {
        method: 'x5c',
        x5c: [simpleX509Certificate],
      },
    })

    expect(compact).toStrictEqual(simpleX509WithoutIss.sdJwtVc)

    const sdJwtVc = sdJwtVcService.fromCompact(compact)
    expect(sdJwtVc.header).toEqual({
      typ: 'dc+sd-jwt',
      alg: 'EdDSA',
      x5c: [simpleX509WithoutIss.trustedCertificate],
    })

    expect(sdJwtVc.prettyClaims).toEqual({
      claim: 'some-claim',
      vct: 'IdentityCredential',
      iat: Math.floor(Date.now() / 1000),
      iss: undefined,
      cnf: { jwk: holderKey.toJson() },
    })
  })
})
