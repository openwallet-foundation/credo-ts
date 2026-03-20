import type { Uint8ArrayBuffer } from '../../../../../types'
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
  modulus: Uint8ArrayBuffer
  exponent: Uint8ArrayBuffer
}): KmsJwkPublicRsa {
  const jwk: KmsJwkPublicRsa = {
    kty: 'RSA',
    n: TypedArrayEncoder.toBase64Url(options.modulus),
    e: TypedArrayEncoder.toBase64Url(options.exponent),
  }

  return jwk
}
