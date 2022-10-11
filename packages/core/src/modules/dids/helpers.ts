import { KeyType, Key } from '../../crypto'

import { DidKey } from './methods/key'

export function isDidKey(key: string) {
  return key.startsWith('did:key')
}

export function didKeyToVerkey(key: string) {
  if (isDidKey(key)) {
    const publicKeyBase58 = DidKey.fromDid(key).key.publicKeyBase58
    return publicKeyBase58
  }
  return key
}

export function verkeyToDidKey(key: string) {
  if (isDidKey(key)) {
    return key
  }
  const publicKeyBase58 = key
  const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
  const didKey = new DidKey(ed25519Key)
  return didKey.did
}

export function didKeyToInstanceOfKey(key: string) {
  const didKey = DidKey.fromDid(key)
  return didKey.key
}

export function verkeyToInstanceOfKey(verkey: string) {
  const ed25519Key = Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)
  return ed25519Key
}
