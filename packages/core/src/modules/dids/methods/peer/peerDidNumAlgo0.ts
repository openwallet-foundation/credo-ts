import { Key } from '../../../../crypto'
import { getDidDocumentForKey } from '../../domain/keyDidDocument'
import { parseDid } from '../../domain/parse'

import { getNumAlgoFromPeerDid, isValidPeerDid, PeerDidNumAlgo } from './didPeer'

export function keyToNumAlgo0DidDocument(key: Key) {
  const did = `did:peer:0${key.fingerprint}`

  return getDidDocumentForKey(did, key)
}

export function didToNumAlgo0DidDocument(did: string) {
  const parsed = parseDid(did)
  const numAlgo = getNumAlgoFromPeerDid(did)

  if (!isValidPeerDid(did)) {
    throw new Error(`Invalid peer did '${did}'`)
  }

  if (numAlgo !== PeerDidNumAlgo.InceptionKeyWithoutDoc) {
    throw new Error(`Invalid numAlgo ${numAlgo}, expected ${PeerDidNumAlgo.InceptionKeyWithoutDoc}`)
  }

  const key = Key.fromFingerprint(parsed.id.substring(1))

  return getDidDocumentForKey(did, key)
}
