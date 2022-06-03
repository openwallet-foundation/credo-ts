import { JsonTransformer } from '../../../../../utils'
import { DidDocument } from '../../../domain'
import { didToNumAlgo2DidDocument, didDocumentToNumAlgo2Did } from '../peerDidNumAlgo2'

import didPeer2Ez6LSbysBase58 from './__fixtures__/didPeer2Ez6LSbysBase58.json'

describe('peerDidNumAlgo2', () => {
  describe('didDocumentToNumAlgo2Did', () => {
    test('transforms method 2 peer did to a did document', async () => {
      expect(didToNumAlgo2DidDocument(didPeer2Ez6LSbysBase58.id).toJSON()).toMatchObject(didPeer2Ez6LSbysBase58)
    })
  })

  describe('didDocumentToNumAlgo2Did', () => {
    test('transforms method 2 peer did document to a did', async () => {
      const expectedDid = didPeer2Ez6LSbysBase58.id

      const didDocument = JsonTransformer.fromJSON(didPeer2Ez6LSbysBase58, DidDocument)

      expect(didDocumentToNumAlgo2Did(didDocument)).toBe(expectedDid)
    })
  })
})
