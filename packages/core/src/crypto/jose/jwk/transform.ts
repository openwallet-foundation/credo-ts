import type { JwkJson, Jwk } from './Jwk'
import type { Key } from '../../Key'

import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'

import { Ed25519Jwk } from './Ed25519Jwk'
import { P256Jwk } from './P256Jwk'
import { P384Jwk } from './P384Jwk'
import { P521Jwk } from './P521Jwk'
import { X25519Jwk } from './X25519Jwk'
import { hasCrv } from './validate'

export function getJwkFromJson(jwkJson: JwkJson): Jwk {
  if (jwkJson.kty === JwaKeyType.OKP) {
    if (hasCrv(jwkJson, JwaCurve.Ed25519)) return Ed25519Jwk.fromJson(jwkJson)
    if (hasCrv(jwkJson, JwaCurve.X25519)) return X25519Jwk.fromJson(jwkJson)
  }

  if (jwkJson.kty === JwaKeyType.EC) {
    if (hasCrv(jwkJson, JwaCurve.P256)) return P256Jwk.fromJson(jwkJson)
    if (hasCrv(jwkJson, JwaCurve.P384)) return P384Jwk.fromJson(jwkJson)
    if (hasCrv(jwkJson, JwaCurve.P521)) return P521Jwk.fromJson(jwkJson)
  }

  throw new Error(`Cannot create JWK from JSON. Unsupported JWK with kty '${jwkJson.kty}'.`)
}

export function getJwkFromKey(key: Key) {
  if (key.keyType === KeyType.Ed25519) return Ed25519Jwk.fromPublicKey(key.publicKey)
  if (key.keyType === KeyType.X25519) return X25519Jwk.fromPublicKey(key.publicKey)

  if (key.keyType === KeyType.P256) return P256Jwk.fromPublicKey(key.publicKey)
  if (key.keyType === KeyType.P384) return P384Jwk.fromPublicKey(key.publicKey)
  if (key.keyType === KeyType.P521) return P521Jwk.fromPublicKey(key.publicKey)

  throw new Error(`Cannot create JWK from key. Unsupported key with type '${key.keyType}'.`)
}
