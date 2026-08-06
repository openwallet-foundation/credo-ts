import type { AgentContext, KeyDidCreateOptions } from '@credo-ts/core'
import { Agent, DidKey, JwtPayload, Kms, utils, X509ModuleConfig } from '@credo-ts/core'
import type { JwtSigner } from '@openid4vc/oauth2'
import { decodeJwt } from '@openid4vc/oauth2'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import { OpenId4VcIssuanceSessionState } from '../../openid4vc-issuer/OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuanceSessionRecord } from '../../openid4vc-issuer/repository'
import { getOid4vcJwtSignCallback, getOid4vcJwtVerifyCallback } from '../callbacks'

const agent = new Agent({
  config: {},
  dependencies: agentDependencies,
  modules: {
    openid4vc: new OpenId4VcModule(),
    inMemory: new InMemoryWalletModule(),
  },
})

const issuanceSession = new OpenId4VcIssuanceSessionRecord({
  createdAt: new Date(),
  expiresAt: utils.addSecondsToDate(new Date(), 300),
  state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
  issuerId: 'issuer-id',
  credentialOfferId: 'credential-offer-id',
  credentialOfferPayload: {
    credential_issuer: 'https://issuer.com',
    credential_configuration_ids: ['configuration-id'],
  },
  openId4VciVersion: 'v1.draft15',
})

// Signs a jwt with the given typ and returns everything the verify callback needs
const createJwt = async (agentContext: AgentContext, options: { typ: string; signer: JwtSigner }) => {
  const { jwt } = await getOid4vcJwtSignCallback(agentContext)(options.signer, {
    header: { alg: options.signer.alg, typ: options.typ },
    payload: new JwtPayload({ iss: 'https://wallet-provider.com' }).toJson(),
  })

  const { header, payload } = decodeJwt({ jwt })
  return { signer: options.signer, compact: jwt, header, payload }
}

describe('getOid4vcJwtVerifyCallback', () => {
  let didUrl: string
  let did: string
  let didSigner: JwtSigner
  let jwkSigner: JwtSigner

  let x5cSigner: JwtSigner
  let certificatePem: string

  const otherDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'

  const verify = (options: Awaited<ReturnType<typeof createJwt>>, callbackOptions?: { issuanceSession?: boolean }) =>
    getOid4vcJwtVerifyCallback(agent.context, {
      issuanceSession: callbackOptions?.issuanceSession === false ? undefined : issuanceSession,
    })(options.signer, { compact: options.compact, header: options.header, payload: options.payload })

  beforeAll(async () => {
    await agent.initialize()

    const { keyId } = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })

    const didCreateResult = await agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyId },
    })

    did = didCreateResult.didState.did as string
    didUrl = `${did}#${DidKey.fromDid(did).publicJwk.fingerprint}`
    // `kid` is the kms key id used for signing, the did document jwk itself carries no key id
    didSigner = { method: 'did', alg: Kms.KnownJwaSignatureAlgorithms.EdDSA, didUrl, kid: keyId }

    const jwkKey = Kms.PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
    )
    jwkSigner = {
      method: 'jwk',
      alg: Kms.KnownJwaSignatureAlgorithms.ES256,
      // biome-ignore lint/suspicious/noExplicitAny: jwk type from kms is compatible
      publicJwk: jwkKey.toJson() as any,
    }

    const certificate = await agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: { commonName: 'Credo Wallet Provider' },
    })
    certificatePem = certificate.toString('pem')
    x5cSigner = {
      method: 'x5c',
      alg: Kms.KnownJwaSignatureAlgorithms.ES256,
      x5c: [certificate.toString('base64url')],
      kid: certificate.publicJwk.keyId,
    }
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  afterEach(() => {
    const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
    agent.context.config.setTrustedIssuersForVerification(undefined)
    x509ModuleConfig.setTrustedCertificatesForVerification(undefined)
    x509ModuleConfig.setTrustedCertificates(undefined)
  })

  describe('did signer', () => {
    test('is rejected when not in the trusted issuers', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: didSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'did', issuance: otherDid }],
      }))

      await expect(verify(jwt)).rejects.toThrow(`Signer did ${did} is not trusted. Unable to verify signature.`)
    })

    test('is accepted when in the trusted issuers', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: didSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'did', issuance: did }],
      }))

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
    })

    test('is rejected when an empty trusted issuers array is returned', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: didSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(verify(jwt)).rejects.toThrow(`Signer did ${did} is not trusted. Unable to verify signature.`)
    })

    test('is allowed by default when no trusted issuers callback is registered', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: didSigner })

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
    })

    test.each([
      ['oauth-authz-req+jwt', 'oauth2SecuredAuthorizationRequest'],
      ['keyattestation+jwt', 'openId4VciKeyAttestation'],
      ['key-attestation+jwt', 'openId4VciKeyAttestation'],
      ['openidvci-issuer-metadata+jwt', 'openId4VciCredentialIssuerMetadata'],
      ['oauth-client-attestation+jwt', 'oauth2ClientAttestation'],
    ])('trusted issuers callback is called for typ %s', async (typ, verificationType) => {
      const getTrustedIssuersForVerification = vi.fn().mockResolvedValue(undefined)
      agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

      const jwt = await createJwt(agent.context, { typ, signer: didSigner })
      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))

      expect(getTrustedIssuersForVerification).toHaveBeenCalledWith(
        agent.context,
        expect.objectContaining({
          signer: { method: 'did', didUrl },
          verification: expect.objectContaining({ type: verificationType }),
        })
      )
    })

    test('trusted issuers callback is not called for an unrelated typ', async () => {
      const getTrustedIssuersForVerification = vi.fn().mockResolvedValue({ trustedIssuers: [] })
      agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

      const jwt = await createJwt(agent.context, { typ: 'openid4vci-proof+jwt', signer: didSigner })
      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))

      expect(getTrustedIssuersForVerification).not.toHaveBeenCalled()
    })

    test.each([
      'key-attestation+jwt',
      'oauth-client-attestation+jwt',
    ])('trusted issuers callback is not called for typ %s without an issuance session', async (typ) => {
      const getTrustedIssuersForVerification = vi.fn().mockResolvedValue({ trustedIssuers: [] })
      agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

      const jwt = await createJwt(agent.context, { typ, signer: didSigner })
      await expect(verify(jwt, { issuanceSession: false })).resolves.toEqual(
        expect.objectContaining({ verified: true })
      )

      expect(getTrustedIssuersForVerification).not.toHaveBeenCalled()
    })
  })

  describe('jwk signer', () => {
    // There is no `jwk` variant of `VerificationSigner`/`TrustedIssuer`, so a bare jwk signed
    // key attestation is not checked against a trust list.
    test('is not checked against the trusted issuers', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: jwkSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
    })
  })

  describe('x5c signer', () => {
    test('is accepted when its certificate is returned as a trusted issuer', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'x509', issuance: [certificatePem] }],
      }))

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
    })

    test('falls back to the deprecated x509 callback, which receives the issuance session id', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      const getTrustedCertificatesForVerification = vi.fn().mockResolvedValue([certificatePem])
      agent.context.dependencyManager
        .resolve(X509ModuleConfig)
        .setTrustedCertificatesForVerification(getTrustedCertificatesForVerification)

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))

      expect(getTrustedCertificatesForVerification).toHaveBeenCalledWith(
        agent.context,
        expect.objectContaining({
          verification: expect.objectContaining({
            type: 'openId4VciKeyAttestation',
            openId4VcIssuanceSessionId: issuanceSession.id,
          }),
        })
      )
    })

    test('does not call the deprecated x509 callback when the trusted issuers callback returns a result', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      const getTrustedCertificatesForVerification = vi.fn().mockResolvedValue([certificatePem])
      agent.context.dependencyManager
        .resolve(X509ModuleConfig)
        .setTrustedCertificatesForVerification(getTrustedCertificatesForVerification)
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'x509', issuance: [certificatePem] }],
      }))

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))

      expect(getTrustedCertificatesForVerification).not.toHaveBeenCalled()
    })

    test('falls back to the globally configured trusted certificates', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      agent.context.dependencyManager.resolve(X509ModuleConfig).setTrustedCertificates([certificatePem])

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
    })

    test('is rejected when an empty trusted issuers array is returned', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(verify(jwt)).rejects.toThrow(
        "trustedCertificates is required when the JWS protected header contains an 'x5c' property."
      )
    })

    test('does not call the trusted issuers callback when trusted certificates are provided', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      const getTrustedIssuersForVerification = vi.fn().mockResolvedValue({ trustedIssuers: [] })
      agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

      const result = await getOid4vcJwtVerifyCallback(agent.context, {
        issuanceSession,
        trustedCertificates: [certificatePem],
      })(jwt.signer, { compact: jwt.compact, header: jwt.header, payload: jwt.payload })

      expect(result).toEqual(expect.objectContaining({ verified: true }))
      expect(getTrustedIssuersForVerification).not.toHaveBeenCalled()
    })
  })
})
