import { CredoError } from '../../../../error'

import { getAlternativeDidsForNumAlgo4Did } from './peerDidNumAlgo4'

const PEER_DID_REGEX = new RegExp(
  '^did:peer:(([01](z)([1-9a-km-zA-HJ-NP-Z]{5,200}))|(2((.[AEVID](z)([1-9a-km-zA-HJ-NP-Z]{5,200}))+(.(S)[0-9a-zA-Z=]*)*))|([4](z[1-9a-km-zA-HJ-NP-Z]{46})(:z[1-9a-km-zA-HJ-NP-Z]{6,}){0,1}))$'
)

export function isValidPeerDid(did: string): boolean {
  const isValid = PEER_DID_REGEX.test(did)

  return isValid
}

export enum PeerDidNumAlgo {
  InceptionKeyWithoutDoc = 0,
  GenesisDoc = 1,
  MultipleInceptionKeyWithoutDoc = 2,
  ShortFormAndLongForm = 4,
}

export function getNumAlgoFromPeerDid(did: string) {
  const numAlgo = Number(did[9])

  if (
    numAlgo !== PeerDidNumAlgo.InceptionKeyWithoutDoc &&
    numAlgo !== PeerDidNumAlgo.GenesisDoc &&
    numAlgo !== PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc &&
    numAlgo !== PeerDidNumAlgo.ShortFormAndLongForm
  ) {
    throw new CredoError(`Invalid peer did numAlgo: ${numAlgo}`)
  }

  return numAlgo as PeerDidNumAlgo
}

/**
 * Given a peer did, returns any alternative forms equivalent to it.
 *
 * @param did
 * @returns array of alternative dids or undefined if not applicable
 */
export function getAlternativeDidsForPeerDid(did: string) {
  if (getNumAlgoFromPeerDid(did) === PeerDidNumAlgo.ShortFormAndLongForm) {
    return getAlternativeDidsForNumAlgo4Did(did)
  }
}
