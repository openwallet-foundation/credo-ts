import type { DidDocument } from './domain'

import { KeyType } from '../../crypto'

import { Key } from './domain/Key'
import { getKeyDidMappingByVerificationMethod } from './domain/key-type'
import { DidKey } from './methods/key'

export function didKeyToVerkey(key: string) {
  if (key.startsWith('did:key')) {
    const publicKeyBase58 = DidKey.fromDid(key).key.publicKeyBase58
    return publicKeyBase58
  }
  return key
}

export function verkeyToDidKey(key: string) {
  if (key.startsWith('did:key')) {
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

export function keyReferenceToKey(didDocument: DidDocument, keyId: string) {
  // FIXME: we allow authentication keys as historically ed25519 keys have been used in did documents
  // for didcomm. In the future we should update this to only be allowed for IndyAgent and DidCommV1 services
  // as didcomm v2 doesn't have this issue anymore
  const verificationMethod = didDocument.dereferenceKey(keyId, ['authentication', 'keyAgreement'])
  const { getKeyFromVerificationMethod } = getKeyDidMappingByVerificationMethod(verificationMethod)
  const key = getKeyFromVerificationMethod(verificationMethod)

  return key
}
