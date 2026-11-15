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
})

export type KmsSignOptions = z.output<typeof zKmsSignOptions>

export const zKmsSignApiOptions = zKmsSignOptions.extend({
  /**
   * The public key `keyId` must have. The signature is only returned if it matches. Pass `null` for symmetric keys or
   * when the public key isn't known.
   */
  expectedPublicJwk: zKmsJwkPublicAsymmetric.nullable(),
})

export type KmsSignApiOptions = z.output<typeof zKmsSignApiOptions>

export interface KmsSignReturn {
  signature: Uint8Array

  /**
   * The public key that signed. Backends that hold the key while signing should return it, so callers that need it
   * don't read the key again.
   */
  publicJwk?: KmsJwkPublic
}
