import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import didKeyBls12381g1 from '../../../__tests__/__fixtures__/didKeyBls12381g1.json'
import didKeyBls12381g1g2 from '../../../__tests__/__fixtures__/didKeyBls12381g1g2.json'
import didKeyBls12381g2 from '../../../__tests__/__fixtures__/didKeyBls12381g2.json'
import didKeyEd25519 from '../../../__tests__/__fixtures__/didKeyEd25519.json'
import didKeyX25519 from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { DidKey } from '../DidKey'

describe('DidKey', () => {
  it('creates a DidKey instance from a did', async () => {
    const documentTypes = [didKeyX25519, didKeyEd25519, didKeyBls12381g1, didKeyBls12381g2, didKeyBls12381g1g2]

    for (const documentType of documentTypes) {
      const didKey = DidKey.fromDid(documentType.id)

      expect(didKey.didDocument.toJSON()).toMatchObject(documentType)
    }
  })

  it('creates a DidKey instance from a key instance', async () => {
    const key = Key.fromPublicKeyBase58(didKeyX25519.keyAgreement[0].publicKeyBase58, KeyType.X25519)
    const didKey = new DidKey(key)

    expect(didKey.did).toBe(didKeyX25519.id)
    expect(didKey.didDocument.toJSON()).toMatchObject(didKeyX25519)
  })
})
