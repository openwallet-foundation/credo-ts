import type {
  Ed25519JwkPublicKey,
  Jwk,
  P256JwkPublicKey,
  P384JwkPublicKey,
  P521JwkPublicKey,
  X25519JwkPublicKey,
} from './JwkTypes'
import type { Key } from './Key'

import { TypedArrayEncoder, Buffer } from '../utils'

import { compress, expand } from './EcCompression'
import {
  jwkCurveToKeyTypeMapping,
  keyTypeToJwkCurveMapping,
  isEd25519JwkPublicKey,
  isX25519JwkPublicKey,
  isP256JwkPublicKey,
  isP384JwkPublicKey,
  isP521JwkPublicKey,
} from './JwkTypes'
import { KeyType } from './KeyType'

export function getKeyDataFromJwk(jwk: Jwk): { keyType: KeyType; publicKey: Uint8Array } {
  // ed25519, x25519
  if (isEd25519JwkPublicKey(jwk) || isX25519JwkPublicKey(jwk)) {
    return {
      publicKey: TypedArrayEncoder.fromBase64(jwk.x),
      keyType: jwkCurveToKeyTypeMapping[jwk.crv],
    }
  }

  // p-256, p-384, p-521
  if (isP256JwkPublicKey(jwk) || isP384JwkPublicKey(jwk) || isP521JwkPublicKey(jwk)) {
    // TODO: do we want to use the compressed key in the Key instance?
    const publicKeyBuffer = Buffer.concat([TypedArrayEncoder.fromBase64(jwk.x), TypedArrayEncoder.fromBase64(jwk.y)])
    const compressedPublicKey = compress(publicKeyBuffer)

    return {
      publicKey: compressedPublicKey,
      keyType: jwkCurveToKeyTypeMapping[jwk.crv],
    }
  }

  throw new Error(`Unsupported JWK kty '${jwk.kty}' and crv '${jwk.crv}'`)
}

export function getJwkFromKey(key: Key): Jwk {
  if (key.keyType === KeyType.Ed25519 || key.keyType === KeyType.X25519) {
    return {
      kty: 'OKP',
      crv: keyTypeToJwkCurveMapping[key.keyType],
      x: TypedArrayEncoder.toBase64URL(key.publicKey),
    } satisfies Ed25519JwkPublicKey | X25519JwkPublicKey
  }

  if (key.keyType === KeyType.P256 || key.keyType === KeyType.P384 || key.keyType === KeyType.P521) {
    const crv = keyTypeToJwkCurveMapping[key.keyType]
    const expanded = expand(key.publicKey, crv)
    const x = expanded.slice(0, expanded.length / 2)
    const y = expanded.slice(expanded.length / 2)

    return {
      kty: 'EC',
      crv,
      x: TypedArrayEncoder.toBase64URL(x),
      y: TypedArrayEncoder.toBase64URL(y),
    } satisfies P256JwkPublicKey | P384JwkPublicKey | P521JwkPublicKey
  }

  throw new Error(`Cannot encode Key as JWK. Unsupported key type '${key.keyType}'`)
}
