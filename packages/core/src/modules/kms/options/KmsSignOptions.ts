import { z } from 'zod'
import { zAnyUint8Array } from '../../../utils/zod'
import { zKnownJwaSignatureAlgorithm } from '../jwk/jwa'
import { type KmsJwkPublic, zKmsJwkPublicAsymmetric } from '../jwk/knownJwk'
import { zKmsKeyId } from './common'

export const zKmsSignOptions = z.object({
  /**
   * The key to use for signing
   */
  keyId: zKmsKeyId,

  /**
   * The JWA signature algorithm to use for signing
   */
  algorithm: zKnownJwaSignatureAlgorithm.describe('The JWA signature algorithm to use for signing'),

  /**
   * The data to sign
   */
  data: zAnyUint8Array.describe('The data to sign'),

  /**
   * The public key `keyId` must have. The signature is only returned if it matches. Pass `null` for symmetric keys or
   * when the public key isn't known.
   *
   * A backend that gets a public key must check the key matches it before signing, and throw a `KeyManagementError`
   * if it doesn't (see `assertExpectedSigningKey`). It must then also return the `publicJwk`.
   */
  expectedPublicJwk: zKmsJwkPublicAsymmetric.nullable(),
})

export type KmsSignOptions = z.output<typeof zKmsSignOptions>

export interface KmsSignReturn {
  signature: Uint8Array

  /**
   * The public key that signed. Required when `expectedPublicJwk` is passed.
   */
  publicJwk?: KmsJwkPublic
}
