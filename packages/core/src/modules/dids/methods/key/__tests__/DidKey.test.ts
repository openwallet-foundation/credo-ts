import { TypedArrayEncoder } from '../../../../../utils'
import { PublicJwk } from '../../../../kms'

import didKeyEd25519 from '../../../__tests__/__fixtures__/didKeyEd25519.json'
import didKeyK256 from '../../../__tests__/__fixtures__/didKeyK256.json'
import didKeyP256 from '../../../__tests__/__fixtures__/didKeyP256.json'
import didKeyP384 from '../../../__tests__/__fixtures__/didKeyP384.json'
import didKeyP521 from '../../../__tests__/__fixtures__/didKeyP521.json'
import didKeyX25519 from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { DidKey } from '../DidKey'

describe('DidKey', () => {
  it('creates a DidKey instance from a did', async () => {
    const documentTypes = [didKeyX25519, didKeyEd25519, didKeyP256, didKeyP384, didKeyP521, didKeyK256]

    for (const documentType of documentTypes) {
      const didKey = DidKey.fromDid(documentType.id)

      expect(didKey.didDocument.toJSON()).toMatchObject(documentType)
    }
  })

  it('creates a DidKey instance from a key instance', async () => {
    const key = PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: TypedArrayEncoder.fromBase58(didKeyX25519.keyAgreement[0].publicKeyBase58),
    })
    const didKey = new DidKey(key)

    expect(didKey.did).toBe(didKeyX25519.id)
    expect(didKey.didDocument.toJSON()).toMatchObject(didKeyX25519)
  })
})
