import { DidDocument, Key, PeerDid, PeerDidNumAlgo } from '../src'
import { JsonTransformer } from '../src/utils'

import { didDocumentToNumAlgo2Did } from './../src/peerDidNumAlgo2'
import didKeyEd25519 from './fixtures/didKeyEd25519.json'
import didPeer0z6MkBase58 from './fixtures/didPeer0z6MkBase58.json'
import didPeer0z6MkMultibase from './fixtures/didPeer0z6MkMultibase.json'
import didPeer1zQmR from './fixtures/didPeer1zQmR.json'
import didPeer1zQmZ from './fixtures/didPeer1zQmZ.json'
import didPeer2Ez6LSbysBase58 from './fixtures/didPeer2Ez6LSbysBase58.json'

describe('DidPeer', () => {
  test('transforms a did document into a valid method 1 did', () => {
    const didPeer1 = PeerDid.fromDidDocument(
      JsonTransformer.fromJSON(didPeer1zQmR, DidDocument),
      PeerDidNumAlgo.GenesisDoc
    )

    expect(didPeer1.did).toBe(didPeer1zQmR.id)
  })

  // FIXME: we need some input data from AFGO for this test to succeed (we create a hash of the document, so any inconsistency is fatal)
  xtest('transforms a did document from aries-framework-go into a valid method 1 did', () => {
    const didPeer1 = PeerDid.fromDidDocument(
      JsonTransformer.fromJSON(didPeer1zQmZ, DidDocument),
      PeerDidNumAlgo.GenesisDoc
    )

    expect(didPeer1.did).toBe(didPeer1zQmZ.id)
  })

  test('extracts the numAlgo from the peer did', async () => {
    // NumAlgo 0
    const key = Key.fromFingerprint(didKeyEd25519.id.split(':')[2])
    const didPeerNumAlgo0 = PeerDid.fromKey(key)

    expect(didPeerNumAlgo0.numAlgo).toBe(PeerDidNumAlgo.InceptionKeyWithoutDoc)
    expect(PeerDid.fromDid('did:peer:0z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL').numAlgo).toBe(
      PeerDidNumAlgo.InceptionKeyWithoutDoc
    )

    // NumAlgo 1
    const peerDidNumAlgo1 = 'did:peer:1zQmZMygzYqNwU6Uhmewx5Xepf2VLp5S4HLSwwgf2aiKZuwa'
    expect(PeerDid.fromDid(peerDidNumAlgo1).numAlgo).toBe(PeerDidNumAlgo.GenesisDoc)

    // NumAlgo 2
    const peerDidNumAlgo2 =
      'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.Vz6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V.Vz6MkgoLTnTypo3tDRwCkZXSccTPHRLhF4ZnjhueYAFpEX6vg.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOlsiZGlkOmV4YW1wbGU6c29tZW1lZGlhdG9yI3NvbWVrZXkiXSwiYSI6WyJkaWRjb21tL3YyIiwiZGlkY29tbS9haXAyO2Vudj1yZmM1ODciXX0'
    expect(PeerDid.fromDid(peerDidNumAlgo2).numAlgo).toBe(PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc)
    expect(PeerDid.fromDidDocument(JsonTransformer.fromJSON(didPeer2Ez6LSbysBase58, DidDocument)).numAlgo).toBe(
      PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
    )
  })

  test('transforms a method 0 did correctly into a did document', async () => {
    const didDocuments = [didPeer0z6MkBase58, didPeer0z6MkMultibase]

    for (const didDocument of didDocuments) {
      const didPeer = PeerDid.fromDid(didDocument.id)
      const expected = didDocument
      const actual = didPeer.didDocument

      expect(expected.authentication[0].id).toBe(actual.verificationMethod[0].id)
      expect(expected.authentication[0].controller).toBe(actual.verificationMethod[0].controller)
      expect(expected.authentication[0].type).toBe(actual.verificationMethod[0].type)
    }
  })

  // TODO: uncomment multibase peerDids after multibase implementation
  test('transforms a method 2 did correctly into a did document', async () => {
    const didDocuments = [
      // didPeer2Ez6LMultibaseMinimalServices,
      // didPeer2Ez6LMultibaseNoServices,
      didPeer2Ez6LSbysBase58,
      // didPeer2Ez6LSbysMultibase,
    ]

    for (const didDocument of didDocuments) {
      const didPeer = PeerDid.fromDid(didDocument.id)
      const expected = didDocument
      const actual = didPeer.didDocument

      expect(actual).toMatchObject(expected)
    }
  })

  // TODO: uncomment multibase peerDids after multibase implementation
  test('transforms a did doc correctly into a numalgo2 did', async () => {
    const didDocuments = [
      // didPeer2Ez6LMultibaseMinimalServices,
      // didPeer2Ez6LMultibaseNoServices,
      didPeer2Ez6LSbysBase58,
      // didPeer2Ez6LSbysMultibase,
    ]

    for (const didDocument of didDocuments) {
      const didDocObj = JsonTransformer.fromJSON(didDocument, DidDocument)
      const didPeer = didDocumentToNumAlgo2Did(didDocObj)
      const expected = didDocObj.id
      const actual = didPeer

      expect(actual).toBe(expected)
    }
  })

  test('transforms a key correctly into a numalgo0 did', async () => {
    const keys = ['z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V']

    for (const key of keys) {
      const keyObj = Key.fromFingerprint(key)
      const didPeer = PeerDid.fromKey(keyObj)
      const expected = key
      const actual = didPeer.did.split(':')[2].substring(1)

      expect(actual).toBe(expected)
    }
  })
})
