import { JsonTransformer } from '../../../../../utils'
import { DidDocument } from '../../../domain'
import { didToNumAlgo2DidDocument, didDocumentToNumAlgo2Did } from '../peerDidNumAlgo2'

import didPeer2ez6L from './__fixtures__/didPeer2ez6L.json'

describe('peerDidNumAlgo2', () => {
  describe('didDocumentToNumAlgo2Did', () => {
    test('transforms method 2 peer did to a did document', async () => {
      expect(didToNumAlgo2DidDocument(didPeer2ez6L.id).toJSON()).toMatchObject(didPeer2ez6L)
    })
  })

  describe('didDocumentToNumAlgo2Did', () => {
    test('transforms method 2 peer did document to a did', async () => {
      const expectedDid = didPeer2ez6L.id

      const didDocument = JsonTransformer.fromJSON(didPeer2ez6L, DidDocument)

      expect(didDocumentToNumAlgo2Did(didDocument)).toBe(expectedDid)
    })
  })
})
