import { type HashName, Hasher } from '../../../crypto/hashes/Hasher'
import type { Uint8ArrayBuffer } from '../../../types'
import { TypedArrayEncoder } from '../../../utils'
import { zParseWithErrorHandling } from '../../../utils/zod'
import { type KmsJwkPublic, zKmsJwkPublic } from './knownJwk'

export const zJwkThumbprintComponents = zKmsJwkPublic.transform((data) => {
  if (data.kty === 'EC') {
    return { crv: data.crv, kty: data.kty, x: data.x, y: data.y }
  }

  if (data.kty === 'OKP') {
    return { crv: data.crv, kty: data.kty, x: data.x }
  }

  if (data.kty === 'RSA') {
    return { e: data.e, kty: data.kty, n: data.n }
  }

  if (data.kty === 'oct') {
    return { k: data.k, kty: data.kty }
  }

  throw new Error('Unsupported kty')
})

export interface CalculateJwkThumbprintOptions {
  /**
   * The jwk to calcualte the thumbprint for.
   */
  jwk: KmsJwkPublic

  /**
   * The hashing algorithm to use for calculating the thumbprint
   */
  hashAlgorithm: HashName
}

export function calculateJwkThumbprint(options: CalculateJwkThumbprintOptions): Uint8ArrayBuffer {
  const jwkThumbprintComponents = zParseWithErrorHandling(
    zJwkThumbprintComponents,
    options.jwk,
    `Provided jwk does not match a supported jwk structure. Either the 'kty' is not supported, or required values are missing.`
  )

  const thumbprint = Hasher.hash(
    TypedArrayEncoder.fromString(JSON.stringify(jwkThumbprintComponents)),
    options.hashAlgorithm
  )

  return thumbprint
}
