import { JsonEncoder } from '../../../../../utils'
import { PublicJwk } from '../../../../kms'
import { DidJwk } from '../DidJwk'

import { p256DidJwkEyJjcnYi0iFixture } from './__fixtures__/p256DidJwkEyJjcnYi0i'
import { x25519DidJwkEyJrdHkiOiJFixture } from './__fixtures__/x25519DidJwkEyJrdHkiOiJ'

describe('DidJwk', () => {
  it('creates a DidJwk instance from a did', async () => {
    const documentTypes = [p256DidJwkEyJjcnYi0iFixture, x25519DidJwkEyJrdHkiOiJFixture]

    for (const documentType of documentTypes) {
      const didJwk = DidJwk.fromDid(documentType.id)

      expect(didJwk.didDocument.toJSON()).toMatchObject(documentType)
    }
  })

  it('creates a DidJwk instance from a jwk instance', async () => {
    const didJwk = DidJwk.fromPublicJwk(
      PublicJwk.fromUnknown(p256DidJwkEyJjcnYi0iFixture.verificationMethod[0].publicKeyJwk)
    )

    expect(didJwk.did).toBe(p256DidJwkEyJjcnYi0iFixture.id)
    expect(didJwk.didDocument.toJSON()).toMatchObject(p256DidJwkEyJjcnYi0iFixture)
  })

  it('omits a kid encoded in the did from publicKeyJwk', async () => {
    const jwk = { ...p256DidJwkEyJjcnYi0iFixture.verificationMethod[0].publicKeyJwk, kid: 'issuer-key-1' }
    const didJwk = DidJwk.fromDid(`did:jwk:${JsonEncoder.toBase64Url(jwk)}`)

    expect(didJwk.didDocument.verificationMethod?.[0].publicKeyJwk).toEqual(
      p256DidJwkEyJjcnYi0iFixture.verificationMethod[0].publicKeyJwk
    )
  })

  it('rejects a DID that encodes private key material', () => {
    const jwk = {
      ...x25519DidJwkEyJrdHkiOiJFixture.verificationMethod[0].publicKeyJwk,
      d: 'private-key-material',
    }

    expect(() => DidJwk.fromDid(`did:jwk:${JsonEncoder.toBase64Url(jwk)}`)).toThrow('JWK contains private key material')
  })

  it('accepts only the #0 DID URL fragment', () => {
    expect(() => DidJwk.fromDid(`${p256DidJwkEyJjcnYi0iFixture.id}#1`)).toThrow("Unsupported did:jwk fragment '#1'")
    expect(() => DidJwk.fromDid(`${p256DidJwkEyJjcnYi0iFixture.id}#`)).toThrow("Unsupported did:jwk fragment '#'")
    expect(DidJwk.fromDid(`${p256DidJwkEyJjcnYi0iFixture.id}#0`).did).toBe(p256DidJwkEyJjcnYi0iFixture.id)
  })

  it('uses use=sig to exclude key agreement', () => {
    const jwk = PublicJwk.fromUnknown({
      ...p256DidJwkEyJjcnYi0iFixture.verificationMethod[0].publicKeyJwk,
      use: 'sig',
    })
    const document = DidJwk.fromPublicJwk(jwk).didDocument

    expect(document.authentication).toHaveLength(1)
    expect(document.keyAgreement).toBeUndefined()
  })

  it('uses use=enc to include only key agreement', () => {
    const jwk = PublicJwk.fromUnknown({
      ...p256DidJwkEyJjcnYi0iFixture.verificationMethod[0].publicKeyJwk,
      use: 'enc',
    })
    const document = DidJwk.fromPublicJwk(jwk).didDocument

    expect(document.keyAgreement).toHaveLength(1)
    expect(document.authentication).toBeUndefined()
    expect(document.assertionMethod).toBeUndefined()
    expect(document.capabilityDelegation).toBeUndefined()
    expect(document.capabilityInvocation).toBeUndefined()
  })
})
