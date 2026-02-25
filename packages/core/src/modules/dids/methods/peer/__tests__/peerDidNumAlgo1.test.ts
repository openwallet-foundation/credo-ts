import { didDocumentJsonToNumAlgo1Did } from '../peerDidNumAlgo1'

import didPeer1zQmR from './__fixtures__/didPeer1zQmR.json'
import didPeer1zQmZ from './__fixtures__/didPeer1zQmZ.json'

describe('peerDidNumAlgo1', () => {
  describe('didDocumentJsonToNumAlgo1Did', () => {
    test('transforms a did document into a valid method 1 did', async () => {
      expect(didDocumentJsonToNumAlgo1Did(didPeer1zQmR)).toEqual(didPeer1zQmR.id)
    })

    // FIXME: we need some input data from AFGO for this test to succeed (we create a hash of the document, so any inconsistency is fatal)
    test.skip('transforms a did document from aries-framework-go into a valid method 1 did', () => {
      expect(didDocumentJsonToNumAlgo1Did(didPeer1zQmZ)).toEqual(didPeer1zQmZ.id)
    })
  })
})
