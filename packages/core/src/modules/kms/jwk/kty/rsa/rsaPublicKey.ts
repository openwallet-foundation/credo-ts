import type { AnyUint8Array } from '../../../../../types'
import { TypedArrayEncoder } from '../../../../../utils'
import type { KmsJwkPublicRsa } from './rsaJwk'

export function rsaPublicJwkToPublicKey(publicJwk: KmsJwkPublicRsa) {
  const modulus = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.n)) as AnyUint8Array
  const exponent = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.e)) as AnyUint8Array

  return {
    modulus,
    exponent,
  }
}

export function rsaPublicKeyToPublicJwk(options: {
  modulus: AnyUint8Array
  exponent: AnyUint8Array
}): KmsJwkPublicRsa {
  const jwk: KmsJwkPublicRsa = {
    kty: 'RSA',
    n: TypedArrayEncoder.toBase64URL(options.modulus),
    e: TypedArrayEncoder.toBase64URL(options.exponent),
  }

  return jwk
}
