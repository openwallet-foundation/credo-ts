import { CredoError } from '../../error'
import { isDid, TypedArrayEncoder } from '../../utils'
import { Ed25519PublicJwk, PublicJwk } from '../kms'

import { DidKey } from './methods/key/DidKey'

export function isDidKey(key: string) {
  return isDid(key, 'key')
}

export function didKeyToVerkey(key: string) {
  if (isDidKey(key)) {
    const publicKey = DidKey.fromDid(key).publicJwk.publicKey
    if (publicKey.kty !== 'OKP' || publicKey.crv !== 'Ed25519') {
      throw new CredoError('Expected OKP key with crv Ed25519')
    }

    const publicKeyBase58 = TypedArrayEncoder.toBase58(publicKey.publicKey)
    return publicKeyBase58
  }

  return key
}

export function verkeyToDidKey(verkey: string) {
  if (isDidKey(verkey)) return verkey

  const ed25519Key = verkeyToPublicJwk(verkey)
  const didKey = new DidKey(ed25519Key)
  return didKey.did
}

export function didKeyToEd25519PublicJwk(key: string) {
  const didKey = DidKey.fromDid(key)
  if (didKey.publicJwk.is(Ed25519PublicJwk)) {
    return didKey.publicJwk as PublicJwk<Ed25519PublicJwk>
  }

  throw new CredoError(
    `Expected public jwk to have kty OKP with crv Ed25519, found ${didKey.publicJwk.jwkTypeHumanDescription}`
  )
}

export function verkeyToPublicJwk(verkey: string) {
  const ed25519Key = PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'Ed25519',
    publicKey: TypedArrayEncoder.fromBase58(verkey),
  }) as PublicJwk<Ed25519PublicJwk>
  return ed25519Key
}
