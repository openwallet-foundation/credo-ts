import { PublicJwk } from '../../../../kms'
import didKeyEd25519 from '../../../__tests__/__fixtures__/didKeyEd25519.json'
import didKeyX25519 from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { didToNumAlgo0DidDocument, publicJwkToNumAlgo0DidDocument } from '../peerDidNumAlgo0'

describe('peerDidNumAlgo0', () => {
  describe('keyToNumAlgo0DidDocument', () => {
    test('transforms a key correctly into a peer did method 0 did document', async () => {
      const didDocuments = [didKeyEd25519, didKeyX25519]

      for (const didDocument of didDocuments) {
        const key = PublicJwk.fromFingerprint(didDocument.id.split(':')[2])

        const didPeerDocument = publicJwkToNumAlgo0DidDocument(key)
        const expectedDidPeerDocument = JSON.parse(JSON.stringify(didDocument).replace(/did:key:/g, 'did:peer:0'))

        expect(didPeerDocument.toJSON()).toMatchObject(expectedDidPeerDocument)
      }
    })
  })

  describe('didToNumAlgo0DidDocument', () => {
    test('transforms a method 0 did correctly into a did document', () => {
      const didDocuments = [didKeyEd25519, didKeyX25519]

      for (const didDocument of didDocuments) {
        const didPeer = didToNumAlgo0DidDocument(didDocument.id.replace('did:key:', 'did:peer:0'))
        const expectedDidPeerDocument = JSON.parse(JSON.stringify(didDocument).replace(/did:key:/g, 'did:peer:0'))

        expect(didPeer.toJSON()).toMatchObject(expectedDidPeerDocument)
      }
    })
  })
})
