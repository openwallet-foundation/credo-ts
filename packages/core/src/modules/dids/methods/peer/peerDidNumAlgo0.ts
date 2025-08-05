import { CredoError } from '../../../../error'
import { PublicJwk } from '../../../kms'
import { getDidDocumentForPublicJwk } from '../../domain/keyDidDocument'
import { parseDid } from '../../domain/parse'

import { PeerDidNumAlgo, getNumAlgoFromPeerDid, isValidPeerDid } from './didPeer'

export function publicJwkToNumAlgo0DidDocument(publicJwk: PublicJwk) {
  const did = `did:peer:0${publicJwk.fingerprint}`

  return getDidDocumentForPublicJwk(did, publicJwk)
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

  const publicJwk = PublicJwk.fromFingerprint(parsed.id.substring(1))

  return getDidDocumentForPublicJwk(did, publicJwk)
}
