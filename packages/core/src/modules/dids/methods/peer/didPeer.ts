const PEER_DID_REGEX = new RegExp(
  '^did:peer:(([01](z)([1-9a-km-zA-HJ-NP-Z]{5,200}))|(2((.[AEVID](z)([1-9a-km-zA-HJ-NP-Z]{5,200}))+(.(S)[0-9a-zA-Z=]*)?)))$'
)

export function isValidPeerDid(did: string): boolean {
  const isValid = PEER_DID_REGEX.test(did)

  return isValid
}

export enum PeerDidNumAlgo {
  InceptionKeyWithoutDoc = 0,
  GenesisDoc = 1,
  MultipleInceptionKeyWithoutDoc = 2,
}

export function getNumAlgoFromPeerDid(did: string) {
  const numAlgo = Number(did[9])

  if (
    numAlgo !== PeerDidNumAlgo.InceptionKeyWithoutDoc &&
    numAlgo !== PeerDidNumAlgo.GenesisDoc &&
    numAlgo !== PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
  ) {
    throw new Error(`Invalid peer did numAlgo: ${numAlgo}`)
  }

  return numAlgo as PeerDidNumAlgo
}
