import { TypedArrayEncoder } from '../../../../../utils'
import type { KmsJwkPublicRsa } from './rsaJwk'

export function rsaPublicJwkToPublicKey(publicJwk: KmsJwkPublicRsa) {
  const modulus = TypedArrayEncoder.fromBase64Url(publicJwk.n)
  const exponent = TypedArrayEncoder.fromBase64Url(publicJwk.e)

  return {
    modulus,
    exponent,
  }
}

export function rsaPublicKeyToPublicJwk(options: { modulus: Uint8Array; exponent: Uint8Array }): KmsJwkPublicRsa {
  const jwk: KmsJwkPublicRsa = {
    kty: 'RSA',
    n: TypedArrayEncoder.toBase64Url(options.modulus),
    e: TypedArrayEncoder.toBase64Url(options.exponent),
  }

  return jwk
}
