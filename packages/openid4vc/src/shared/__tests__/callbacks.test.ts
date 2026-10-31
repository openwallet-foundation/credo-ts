import type { AgentContext, KeyDidCreateOptions } from '@credo-ts/core'
import { Agent, DidKey, JwtPayload, Kms, utils, X509ModuleConfig } from '@credo-ts/core'
import type { Jwk, JwtSigner } from '@openid4vc/oauth2'
import { decodeJwt } from '@openid4vc/oauth2'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import { OpenId4VcIssuanceSessionState } from '../../openid4vc-issuer/OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuanceSessionRecord } from '../../openid4vc-issuer/repository'
import {
  getOid4vcDecryptJweCallback,
  getOid4vcEncryptJweCallback,
  getOid4vcJwtSignCallback,
  getOid4vcJwtVerifyCallback,
} from '../callbacks'

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

beforeAll(async () => {
  await agent.initialize()
})

afterAll(async () => {
  await agent.shutdown()
})

describe('getOid4vcJwtVerifyCallback', () => {
  let didUrl: string
  let did: string
  let didSigner: JwtSigner
  let jwkSigner: JwtSigner
  let jwkSignerKey: Kms.PublicJwk

  let x5cSigner: JwtSigner
  let certificatePem: string

  const otherDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'

  const verify = (options: Awaited<ReturnType<typeof createJwt>>, callbackOptions?: { issuanceSession?: boolean }) =>
    getOid4vcJwtVerifyCallback(agent.context, {
      issuanceSession: callbackOptions?.issuanceSession === false ? undefined : issuanceSession,
    })(options.signer, { compact: options.compact, header: options.header, payload: options.payload })

  beforeAll(async () => {
    const { keyId } = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })

    const didCreateResult = await agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyId },
    })

    did = didCreateResult.didState.did as string
    didUrl = `${did}#${DidKey.fromDid(did).publicJwk.fingerprint}`
    // `kid` is the kms key id used for signing, the did document jwk itself carries no key id
    didSigner = { method: 'did', alg: Kms.KnownJwaSignatureAlgorithms.EdDSA, didUrl, kid: keyId }

    jwkSignerKey = Kms.PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
    )
    jwkSigner = {
      method: 'jwk',
      alg: Kms.KnownJwaSignatureAlgorithms.ES256,
      // biome-ignore lint/suspicious/noExplicitAny: jwk type from kms is compatible
      publicJwk: jwkSignerKey.toJson() as any,
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

  afterEach(() => {
    const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
    agent.context.config.setTrustedIssuersForVerification(undefined)
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

    test('is rejected when no trusted issuers callback is registered', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: didSigner })

      await expect(verify(jwt)).rejects.toThrow(
        "No trusted issuers configured for signer method 'did'. Signer cannot be verified."
      )
    })

    test.each([
      ['oauth-authz-req+jwt', 'oauth2SecuredAuthorizationRequest'],
      ['keyattestation+jwt', 'openId4VciKeyAttestation'],
      ['key-attestation+jwt', 'openId4VciKeyAttestation'],
      ['openidvci-issuer-metadata+jwt', 'openId4VciCredentialIssuerMetadata'],
      ['oauth-client-attestation+jwt', 'oauth2ClientAttestation'],
      ['application/oauth-client-attestation+jwt', 'oauth2ClientAttestation'],
      ['Application/Key-Attestation+JWT', 'openId4VciKeyAttestation'],
    ])('trusted issuers callback is called for typ %s', async (typ, verificationType) => {
      const getTrustedIssuersForVerification = vi
        .fn()
        .mockResolvedValue({ trustedIssuers: [{ method: 'did', issuance: did }] })
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

    test.each(['openid4vci-proof+jwt', 'dpop+jwt', 'oauth-client-attestation-pop+jwt', 'at+jwt'])(
      'trusted issuers callback is not called for typ %s',
      async (typ) => {
        const getTrustedIssuersForVerification = vi.fn().mockResolvedValue({ trustedIssuers: [] })
        agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

        const jwt = await createJwt(agent.context, { typ, signer: didSigner })
        await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))

        expect(getTrustedIssuersForVerification).not.toHaveBeenCalled()
      }
    )

    test.each(['key-attestation+jwt', 'oauth-client-attestation+jwt'])(
      'is rejected for typ %s without an issuance session',
      async (typ) => {
        const getTrustedIssuersForVerification = vi
          .fn()
          .mockResolvedValue({ trustedIssuers: [{ method: 'did', issuance: did }] })
        agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

        const jwt = await createJwt(agent.context, { typ, signer: didSigner })
        await expect(verify(jwt, { issuanceSession: false })).rejects.toThrow(
          `Unable to verify jwt with typ '${typ}'. The signer can't be checked against the trusted issuers, as the jwt type is not supported without an issuance session.`
        )

        expect(getTrustedIssuersForVerification).not.toHaveBeenCalled()
      }
    )

    test.each(['jwt', undefined])('is rejected for unknown typ %s', async (typ) => {
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'did', issuance: did }],
      }))

      const jwt = await createJwt(agent.context, { typ: typ as string, signer: didSigner })
      await expect(verify(jwt)).rejects.toThrow(`Unable to verify jwt with typ '${typ}'.`)
    })

    test('is accepted for an id token without a trusted issuers callback', async () => {
      const jwt = await createJwt(agent.context, { typ: 'JWT', signer: didSigner })

      await expect(
        getOid4vcJwtVerifyCallback(agent.context, { isIdTokenJwt: true })(jwt.signer, {
          compact: jwt.compact,
          header: jwt.header,
          payload: jwt.payload,
        })
      ).resolves.toEqual(expect.objectContaining({ verified: true }))
    })
  })

  describe('jwk signer', () => {
    test('is accepted when in the trusted issuers', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: jwkSigner })
      const getTrustedIssuersForVerification = vi.fn().mockResolvedValue({
        trustedIssuers: [{ method: 'jwk', issuance: jwkSignerKey.toJson() }],
      })
      agent.context.config.setTrustedIssuersForVerification(getTrustedIssuersForVerification)

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
      expect(getTrustedIssuersForVerification).toHaveBeenCalledWith(
        agent.context,
        expect.objectContaining({
          signer: { method: 'jwk', publicJwk: expect.any(Kms.PublicJwk) },
          verification: expect.objectContaining({ type: 'openId4VciKeyAttestation' }),
        })
      )
    })

    test('is rejected when not in the trusted issuers', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: jwkSigner })
      const otherJwk = (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'jwk', issuance: otherJwk }],
      }))

      await expect(verify(jwt)).rejects.toThrow('Signer jwk is not trusted. Unable to verify signature.')
    })

    test('is rejected when an empty trusted issuers array is returned', async () => {
      const jwt = await createJwt(agent.context, { typ: 'openidvci-issuer-metadata+jwt', signer: jwkSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(verify(jwt)).rejects.toThrow('Signer jwk is not trusted. Unable to verify signature.')
    })

    test.each([
      'oauth-client-attestation+jwt',
      'application/oauth-client-attestation+jwt',
      'key-attestation+jwt',
      'Application/Key-Attestation+JWT',
      'openidvci-issuer-metadata+jwt',
      'oauth-authz-req+jwt',
    ])('is rejected for typ %s when no trusted issuers callback is registered', async (typ) => {
      const jwt = await createJwt(agent.context, { typ, signer: jwkSigner })

      await expect(verify(jwt)).rejects.toThrow(
        "No trusted issuers configured for signer method 'jwk'. Signer cannot be verified."
      )
    })

    test.each(['openid4vci-proof+jwt', 'dpop+jwt', 'oauth-client-attestation-pop+jwt', 'at+jwt'])(
      'is accepted for typ %s without a trusted issuers callback',
      async (typ) => {
        const jwt = await createJwt(agent.context, { typ, signer: jwkSigner })

        await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
      }
    )
  })

  describe('x5c signer', () => {
    test('is accepted when its certificate is returned as a trusted issuer', async () => {
      const jwt = await createJwt(agent.context, { typ: 'key-attestation+jwt', signer: x5cSigner })
      agent.context.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'x509', issuance: [certificatePem] }],
      }))

      await expect(verify(jwt)).resolves.toEqual(expect.objectContaining({ verified: true }))
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

describe('getOid4vcDecryptJweCallback', () => {
  const createEncryptionKey = async () =>
    (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk as Jwk

  const encrypt = async (publicJwk: Jwk) =>
    (
      await getOid4vcEncryptJweCallback(agent.context)(
        { method: 'jwk', publicJwk, alg: 'ECDH-ES', enc: 'A256GCM' },
        'secret payload'
      )
    ).jwe

  test('decrypts with the provided jwk', async () => {
    const encryptionJwk = await createEncryptionKey()
    const jwe = await encrypt(encryptionJwk)

    await expect(getOid4vcDecryptJweCallback(agent.context)(jwe, { jwk: encryptionJwk })).resolves.toMatchObject({
      decrypted: true,
      payload: 'secret payload',
      decryptionJwk: { kid: encryptionJwk.kid },
    })
  })

  test('does not fall back to the kid from the jwe header when no jwk is provided', async () => {
    const encryptionJwk = await createEncryptionKey()
    const jwe = await encrypt(encryptionJwk)

    await expect(getOid4vcDecryptJweCallback(agent.context)(jwe)).resolves.toMatchObject({
      decrypted: false,
      header: { kid: encryptionJwk.kid },
    })
  })

  test('decrypts with the provided jwk instead of the kid from the jwe header', async () => {
    const encryptionJwk = await createEncryptionKey()
    const otherJwk = await createEncryptionKey()
    const jwe = await encrypt(otherJwk)

    await expect(getOid4vcDecryptJweCallback(agent.context)(jwe, { jwk: encryptionJwk })).resolves.toMatchObject({
      decrypted: false,
      header: { kid: otherJwk.kid },
    })
  })
})
