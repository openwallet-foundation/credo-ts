import { DidDocument, DidKey, TypedArrayEncoder } from '@credo-ts/core'
import { vi } from 'vitest'
import { DidResolverService } from '../../dids/services'
import { PublicJwk } from '../../kms'
import { createHolderBindingTestSetup, useAuthenticationOnlyDid } from './holderBindingTestSetup'
import { sdJwtVcPresentationWithCnfKid, sdJwtVcWithCnfKid } from './sdjwtvc.cnf-kid.fixtures'

describe('SdJwtVcService DID holder binding', () => {
  let setup: Awaited<ReturnType<typeof createHolderBindingTestSetup>>

  beforeAll(async () => {
    setup = await createHolderBindingTestSetup('sdjwtvc-did-holder')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const credentialWithHolderKid = async (kid: string) => {
    const [jwt, ...disclosures] = sdJwtVcWithCnfKid.split('~')
    const [header, encodedPayload] = jwt.split('.')
    const payload = JSON.parse(TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64Url(encodedPayload)))
    payload.cnf = { kid }
    const signingInput = `${header}.${TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JSON.stringify(payload)))}`
    const { signature } = await setup.agent.kms.sign({
      keyId: setup.issuer.key.keyId,
      algorithm: setup.issuer.key.signatureAlgorithm,
      data: TypedArrayEncoder.fromUtf8String(signingInput),
    })
    return [`${signingInput}.${TypedArrayEncoder.toBase64Url(signature)}`, ...disclosures].join('~')
  }

  test('signs, presents and verifies a DID-bound credential with a disclosure', async () => {
    const { agent, service, issuer, holder } = setup
    vi.spyOn(agent.kms, 'randomBytes').mockImplementation(() => TypedArrayEncoder.fromUtf8String('salt'))
    vi.spyOn(Date, 'now').mockReturnValue(1698151532 * 1000)
    const credential = await service.sign(agent.context, {
      payload: { claim: 'some-claim', vct: 'IdentityCredential' },
      disclosureFrame: { _sd: ['claim'] },
      holder: { method: 'did', didUrl: holder.didUrl },
      issuer: { method: 'did', didUrl: issuer.didUrl },
    })
    expect(credential.payload.cnf).toEqual({ kid: holder.didUrl })
    expect(credential.compact).toBe(sdJwtVcWithCnfKid)

    const nonce = 'did-holder-kid'
    const presentation = await service.present(agent.context, {
      sdJwtVc: credential.compact,
      presentationFrame: { claim: true },
      verifierMetadata: { audience: 'verifier', nonce, issuedAt: Math.floor(Date.now() / 1000) },
    })
    expect(presentation).toBe(sdJwtVcPresentationWithCnfKid)
    const result = await service.verify(agent.context, {
      compactSdJwtVc: presentation,
      keyBinding: { audience: 'verifier', nonce },
      requiredClaimKeys: ['claim'],
    })
    expect(result.isValid).toBe(true)
    expect(result.sdJwtVc?.prettyClaims.claim).toBe('some-claim')
  })

  test('authentication-only DID holder can sign and verify cnf.kid', async () => {
    const { agent, service, issuer, holder } = setup
    await useAuthenticationOnlyDid(agent.context, holder.key)
    const credential = await service.sign(agent.context, {
      payload: { claim: 'some-claim', vct: 'IdentityCredential' },
      holder: { method: 'did', didUrl: holder.didUrl },
      issuer: { method: 'did', didUrl: issuer.didUrl },
    })
    expect(credential.payload.cnf).toEqual({ kid: holder.didUrl })
    const nonce = 'auth-only-kid'
    const presentation = await service.present(agent.context, {
      sdJwtVc: credential.compact,
      presentationFrame: {},
      verifierMetadata: { audience: 'verifier', nonce, issuedAt: Math.floor(Date.now() / 1000) },
    })
    const result = await service.verify(agent.context, {
      compactSdJwtVc: presentation,
      keyBinding: { audience: 'verifier', nonce },
    })
    expect(result.isValid).toBe(true)
  })

  test('does not sign a presentation for an unregistered holder DID even if its key exists in KMS', async () => {
    const { agent, service, issuer } = setup
    const key = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const didUrl = new DidKey(PublicJwk.fromUnknown(key.publicJwk)).didDocument.verificationMethod?.[0]?.id
    if (!didUrl) throw new Error('Expected a DID verification method')

    // Deliberately do not call agent.dids.import: the key exists in KMS, but no created-DID record maps it to this DID.
    const credential = await service.sign(agent.context, {
      payload: { claim: 'some-claim', vct: 'IdentityCredential' },
      issuer: { method: 'did', didUrl: issuer.didUrl },
      holder: { method: 'did', didUrl },
    })
    await expect(
      service.present(agent.context, {
        sdJwtVc: credential.compact,
        verifierMetadata: {
          issuedAt: 1698151532,
          audience: 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y',
          nonce: 'unregistered-holder',
        },
      })
    ).rejects.toThrow('not found')
  })

  test('rejects a holder verification method without an authentication or assertionMethod purpose', async () => {
    const { agent, service, issuer, holder } = setup
    const didDocument = new DidKey(holder.key).didDocument
    const withoutHolderPurpose = new DidDocument({
      id: didDocument.id,
      verificationMethod: didDocument.verificationMethod,
    })
    const didResolver = agent.context.dependencyManager.resolve(DidResolverService)
    const resolveDidDocument = didResolver.resolveDidDocument.bind(didResolver)
    vi.spyOn(didResolver, 'resolveDidDocument').mockImplementation(async (context, didUrl) =>
      didUrl.split('#')[0] === didDocument.id ? withoutHolderPurpose : resolveDidDocument(context, didUrl)
    )
    await didResolver.invalidateCacheForDid(agent.context, didDocument.id)

    await expect(
      service.sign(agent.context, {
        payload: { claim: 'some-claim', vct: 'IdentityCredential' },
        holder: { method: 'did', didUrl: holder.didUrl },
        issuer: { method: 'did', didUrl: issuer.didUrl },
      })
    ).rejects.toThrow('Unable to locate verification method')

    const result = await service.verify(agent.context, {
      compactSdJwtVc: sdJwtVcPresentationWithCnfKid,
      keyBinding: { audience: 'verifier', nonce: 'did-holder-kid' },
    })
    if (result.isValid) throw new Error('Expected holder verification purpose to be rejected')
    expect(result.error).toHaveProperty('message', expect.stringContaining('Unable to locate verification method'))
  })

  test('rejects a signed credential referencing a nonexistent holder verification method', async () => {
    const { agent, service, holder } = setup
    const compact = await credentialWithHolderKid(`${holder.didUrl.split('#')[0]}#missing`)
    const result = await service.verify(agent.context, { compactSdJwtVc: compact })
    if (result.isValid) throw new Error('Expected nonexistent holder verification method to be rejected')
    expect(result.error).toHaveProperty('message', expect.stringContaining('Unable to locate verification method'))
  })

  test('rejects a signed credential with an invalid DID URL in cnf.kid', async () => {
    const compact = await credentialWithHolderKid('did:key:missing')
    expect(() => setup.service.fromCompact(compact)).toThrow('Only absolute KIDs for cnf are supported')
    const result = await setup.service.verify(setup.agent.context, { compactSdJwtVc: compact })
    if (result.isValid) throw new Error('Expected holder DID URL without fragment to be rejected')
    expect(result.error).toHaveProperty(
      'message',
      'Invalid holder kid for did. Only absolute KIDs for cnf are supported'
    )
  })

  test('rejects a signed credential with a non-DID cnf.kid', async () => {
    const compact = await credentialWithHolderKid('not-a-did#key')
    expect(() => setup.service.fromCompact(compact)).toThrow('Only absolute KIDs for cnf are supported')
    const result = await setup.service.verify(setup.agent.context, { compactSdJwtVc: compact })
    if (result.isValid) throw new Error('Expected non-DID holder key ID to be rejected')
    expect(result.error).toHaveProperty(
      'message',
      'Invalid holder kid for did. Only absolute KIDs for cnf are supported'
    )
  })
})
