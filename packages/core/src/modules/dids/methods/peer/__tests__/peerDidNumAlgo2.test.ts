import { JsonTransformer } from '../../../../../utils'
import { DidDocument } from '../../../domain'
import { didToNumAlgo2DidDocument, didDocumentToNumAlgo2Did } from '../peerDidNumAlgo2'

import didPeer2Ez6L from './__fixtures__/didPeer2Ez6L.json'
import didPeer2Ez6LMoreServices from './__fixtures__/didPeer2Ez6LMoreServices.json'

describe('peerDidNumAlgo2', () => {
  describe('didDocumentToNumAlgo2Did', () => {
    test('transforms method 2 peer did to a did document', async () => {
      expect(didToNumAlgo2DidDocument(didPeer2Ez6L.id).toJSON()).toMatchObject(didPeer2Ez6L)

      expect(didToNumAlgo2DidDocument(didPeer2Ez6LMoreServices.id).toJSON()).toMatchObject(didPeer2Ez6LMoreServices)
    })
  })

  describe('didDocumentToNumAlgo2Did', () => {
    test('transforms method 2 peer did document to a did', async () => {
      const expectedDid = didPeer2Ez6L.id

      const didDocument = JsonTransformer.fromJSON(didPeer2Ez6L, DidDocument)

      expect(didDocumentToNumAlgo2Did(didDocument)).toBe(expectedDid)
    })
  })
})
