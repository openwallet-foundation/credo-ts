import { Key } from '../../../../../crypto'
import peerKeyBls12381g1 from '../../../__tests__/__fixtures__/peerKeyBls12381g1.json'
import peerKeyBls12381g1g2 from '../../../__tests__/__fixtures__/peerKeyBls12381g1g2.json'
import peerKeyBls12381g2 from '../../../__tests__/__fixtures__/peerKeyBls12381g2.json'
import peerKeyEd25519 from '../../../__tests__/__fixtures__/peerKeyEd25519.json'
import peerKeyX25519 from '../../../__tests__/__fixtures__/peerKeyX25519.json'
import { didToNumAlgo0DidDocument, keyToNumAlgo0DidDocument } from '../peerDidNumAlgo0'

describe('peerDidNumAlgo0', () => {
  describe('keyToNumAlgo0DidDocument', () => {
    test('transforms a key correctly into a peer did method 0 did document', async () => {
      const didDocuments = [peerKeyEd25519, peerKeyBls12381g1, peerKeyX25519, peerKeyBls12381g1g2, peerKeyBls12381g2]

      for (const didDocument of didDocuments) {
        const key = Key.fromFingerprint(didDocument.id.replace('did:peer:0', ''))

        const didPeerDocument = keyToNumAlgo0DidDocument(key)

        expect(didPeerDocument.toJSON()).toMatchObject(didDocument)
      }
    })
  })

  describe('didToNumAlgo0DidDocument', () => {
    test('transforms a method 0 did correctly into a did document', () => {
      const didDocuments = [peerKeyEd25519, peerKeyBls12381g1, peerKeyX25519, peerKeyBls12381g1g2, peerKeyBls12381g2]

      for (const didDocument of didDocuments) {
        const didPeer = didToNumAlgo0DidDocument(didDocument.id)

        expect(didPeer.toJSON()).toMatchObject(didDocument)
      }
    })
  })
})
