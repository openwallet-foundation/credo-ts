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
})
