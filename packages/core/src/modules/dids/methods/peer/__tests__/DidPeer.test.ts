import { JsonTransformer } from '../../../../../utils'
import didKeyBls12381g1 from '../../../__tests__/__fixtures__/didKeyBls12381g1.json'
import didKeyBls12381g1g2 from '../../../__tests__/__fixtures__/didKeyBls12381g1g2.json'
import didKeyBls12381g2 from '../../../__tests__/__fixtures__/didKeyBls12381g2.json'
import didKeyEd25519 from '../../../__tests__/__fixtures__/didKeyEd25519.json'
import didKeyX25519 from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { DidDocument, Key } from '../../../domain'
import { DidPeer, PeerDidNumAlgo } from '../DidPeer'

import didPeer1zQmR from './__fixtures__/didPeer1zQmR.json'
import didPeer1zQmZ from './__fixtures__/didPeer1zQmZ.json'
import didPeer2ez6L from './__fixtures__/didPeer2ez6L.json'

describe('DidPeer', () => {
  test('transforms a key correctly into a peer did method 0 did document', async () => {
    const didDocuments = [didKeyEd25519, didKeyBls12381g1, didKeyX25519, didKeyBls12381g1g2, didKeyBls12381g2]

    for (const didDocument of didDocuments) {
      const key = Key.fromFingerprint(didDocument.id.split(':')[2])

      const didPeer = DidPeer.fromKey(key)
      const expectedDidPeerDocument = JSON.parse(
        JSON.stringify(didDocument).replace(new RegExp('did:key:', 'g'), 'did:peer:0')
      )

      expect(didPeer.didDocument.toJSON()).toMatchObject(expectedDidPeerDocument)
    }
  })

  test('transforms a method 2 did correctly into a did document', () => {
    expect(DidPeer.fromDid(didPeer2ez6L.id).didDocument.toJSON()).toMatchObject(didPeer2ez6L)
  })

  test('transforms a method 0 did correctly into a did document', () => {
    const didDocuments = [didKeyEd25519, didKeyBls12381g1, didKeyX25519, didKeyBls12381g1g2, didKeyBls12381g2]

    for (const didDocument of didDocuments) {
      const didPeer = DidPeer.fromDid(didDocument.id.replace('did:key:', 'did:peer:0'))
      const expectedDidPeerDocument = JSON.parse(
        JSON.stringify(didDocument).replace(new RegExp('did:key:', 'g'), 'did:peer:0')
      )

      expect(didPeer.didDocument.toJSON()).toMatchObject(expectedDidPeerDocument)
    }
  })

  test('transforms a did document into a valid method 2 did', () => {
    const didPeer2 = DidPeer.fromDidDocument(
      JsonTransformer.fromJSON(didPeer2ez6L, DidDocument),
      PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
    )

    expect(didPeer2.did).toBe(didPeer2ez6L.id)
  })

  test('transforms a did document into a valid method 1 did', () => {
    const didPeer1 = DidPeer.fromDidDocument(
      JsonTransformer.fromJSON(didPeer1zQmR, DidDocument),
      PeerDidNumAlgo.GenesisDoc
    )

    expect(didPeer1.did).toBe(didPeer1zQmR.id)
  })

  // FIXME: we need some input data from AFGO for this test to succeed (we create a hash of the document, so any inconsistency is fatal)
  xtest('transforms a did document from aries-framework-go into a valid method 1 did', () => {
    const didPeer1 = DidPeer.fromDidDocument(
      JsonTransformer.fromJSON(didPeer1zQmZ, DidDocument),
      PeerDidNumAlgo.GenesisDoc
    )

    expect(didPeer1.did).toBe(didPeer1zQmZ.id)
  })

  test('extracts the numAlgo from the peer did', async () => {
    // NumAlgo 0
    const key = Key.fromFingerprint(didKeyEd25519.id.split(':')[2])
    const didPeerNumAlgo0 = DidPeer.fromKey(key)

    expect(didPeerNumAlgo0.numAlgo).toBe(PeerDidNumAlgo.InceptionKeyWithoutDoc)
    expect(DidPeer.fromDid('did:peer:0z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL').numAlgo).toBe(
      PeerDidNumAlgo.InceptionKeyWithoutDoc
    )

    // NumAlgo 1
    const peerDidNumAlgo1 = 'did:peer:1zQmZMygzYqNwU6Uhmewx5Xepf2VLp5S4HLSwwgf2aiKZuwa'
    expect(DidPeer.fromDid(peerDidNumAlgo1).numAlgo).toBe(PeerDidNumAlgo.GenesisDoc)

    // NumAlgo 2
    const peerDidNumAlgo2 =
      'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.Vz6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V.Vz6MkgoLTnTypo3tDRwCkZXSccTPHRLhF4ZnjhueYAFpEX6vg.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOlsiZGlkOmV4YW1wbGU6c29tZW1lZGlhdG9yI3NvbWVrZXkiXSwiYSI6WyJkaWRjb21tL3YyIiwiZGlkY29tbS9haXAyO2Vudj1yZmM1ODciXX0'
    expect(DidPeer.fromDid(peerDidNumAlgo2).numAlgo).toBe(PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc)
    expect(DidPeer.fromDidDocument(JsonTransformer.fromJSON(didPeer2ez6L, DidDocument)).numAlgo).toBe(
      PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
    )
  })
})
