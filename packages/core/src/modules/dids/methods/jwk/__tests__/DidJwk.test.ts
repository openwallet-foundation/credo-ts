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

  it('rejects a did that contains a private key', () => {
    expect(() =>
      DidJwk.fromDid(
        'did:jwk:eyJjcnYiOiJFZDI1NTE5IiwiZCI6InNoQ05pQTFzd0Rfc0J4b1JqZGV3c3QxYkp4X191UkVwblNkVlk1S05HeTgiLCJ4IjoiM3g0aTJhVnMtelRvQ1cwaWVCQV9qYXpWX1hLX2FjempwaFoxUHJTUFZWWSIsImt0eSI6Ik9LUCJ9'
      )
    ).toThrow('did:jwk must not contain a private key')
  })

  it('keeps a kid that is encoded in the did', async () => {
    const jwk = { ...p256DidJwkEyJjcnYi0iFixture.verificationMethod[0].publicKeyJwk, kid: 'issuer-key-1' }
    const didJwk = DidJwk.fromDid(`did:jwk:${JsonEncoder.toBase64Url(jwk)}`)

    expect(didJwk.didDocument.verificationMethod?.[0].publicKeyJwk).toEqual(jwk)
  })
})
