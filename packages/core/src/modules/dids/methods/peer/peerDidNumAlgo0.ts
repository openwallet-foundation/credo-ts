import { Key } from '../../../../crypto/Key'
import { CredoError } from '../../../../error'
import { getDidDocumentForKey } from '../../domain/keyDidDocument'
import { parseDid } from '../../domain/parse'

import { PeerDidNumAlgo, getNumAlgoFromPeerDid, isValidPeerDid } from './didPeer'

export function keyToNumAlgo0DidDocument(key: Key) {
  const did = `did:peer:0${key.fingerprint}`

  return getDidDocumentForKey(did, key)
}

export function didToNumAlgo0DidDocument(did: string) {
  const parsed = parseDid(did)
  const numAlgo = getNumAlgoFromPeerDid(did)

  if (!isValidPeerDid(did)) {
    throw new CredoError(`Invalid peer did '${did}'`)
  }

  if (numAlgo !== PeerDidNumAlgo.InceptionKeyWithoutDoc) {
    throw new CredoError(`Invalid numAlgo ${numAlgo}, expected ${PeerDidNumAlgo.InceptionKeyWithoutDoc}`)
  }

  const key = Key.fromFingerprint(parsed.id.substring(1))

  return getDidDocumentForKey(did, key)
}
