import { TypedArrayEncoder } from '../../../../../utils'
import type { KmsJwkPublicRsa } from './rsaJwk'

export function rsaPublicJwkToPublicKey(publicJwk: KmsJwkPublicRsa) {
  const modulus = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.n))
  const exponent = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.e))

  return {
    modulus,
    exponent,
  }
}

export function rsaPublicKeyToPublicJwk(options: {
  modulus: Uint8Array
  exponent: Uint8Array
}): KmsJwkPublicRsa {
  const jwk: KmsJwkPublicRsa = {
    kty: 'RSA',
    n: TypedArrayEncoder.toBase64URL(options.modulus),
    e: TypedArrayEncoder.toBase64URL(options.exponent),
  }

  return jwk
}
