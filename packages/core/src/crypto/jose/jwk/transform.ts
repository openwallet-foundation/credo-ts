import type { JwkJson, Jwk } from './Jwk'
import type { Key } from '../../Key'

import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'

import { Ed25519Jwk } from './Ed25519Jwk'
import { P_256Jwk } from './P_256Jwk'
import { P_384Jwk } from './P_384Jwk'
import { P_521Jwk } from './P_521Jwk'
import { X25519Jwk } from './X25519Jwk'
import { hasCrv } from './validate'

export function getJwkFromJson(jwkJson: JwkJson): Jwk {
  if (jwkJson.kty === JwaKeyType.OKP) {
    if (hasCrv(jwkJson, JwaCurve.Ed25519)) return Ed25519Jwk.fromJson(jwkJson)
    if (hasCrv(jwkJson, JwaCurve.X25519)) return X25519Jwk.fromJson(jwkJson)
  }

  if (jwkJson.kty === JwaKeyType.EC) {
    if (hasCrv(jwkJson, JwaCurve.P_256)) return P_256Jwk.fromJson(jwkJson)
    if (hasCrv(jwkJson, JwaCurve.P_384)) return P_384Jwk.fromJson(jwkJson)
    if (hasCrv(jwkJson, JwaCurve.P_521)) return P_521Jwk.fromJson(jwkJson)
  }

  throw new Error(`Cannot create JWK from JSON. Unsupported JWK with kty '${jwkJson.kty}'.`)
}

export function getJwkFromKey(key: Key) {
  if (key.keyType === KeyType.Ed25519) return Ed25519Jwk.fromPublicKey(key.publicKey)
  if (key.keyType === KeyType.X25519) return X25519Jwk.fromPublicKey(key.publicKey)

  if (key.keyType === KeyType.P256) return P_256Jwk.fromPublicKey(key.publicKey)
  if (key.keyType === KeyType.P384) return P_384Jwk.fromPublicKey(key.publicKey)
  if (key.keyType === KeyType.P521) return P_521Jwk.fromPublicKey(key.publicKey)

  throw new Error(`Cannot create JWK from key. Unsupported key with type '${key.keyType}'.`)
}
