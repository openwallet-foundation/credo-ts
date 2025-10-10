import type { KmsJwkPublic } from '../jwk/knownJwk'

import { z } from 'zod'
import { zKnownJwaSignatureAlgorithm } from '../jwk/jwa'
import { zKmsJwkPublicAsymmetric } from '../jwk/knownJwk'
import { zKmsKeyId } from './common'

export const zKmsVerifyOptions = z.object({
  /**
   * The key to verify with. Either a string referring to a keyId, or a `KmsJwkPublicAssymetric` for verifying with a
   * public asymmetric JWK.
   *
   * It is currently not possible to verify a signature for a symmetric key
   * that is not already present in the KMS.
   */
  key: z.union([
    z.object({
      keyId: zKmsKeyId,

      // never helps with type narrowing
      publicJwk: z.never().optional(),
    }),
    z.object({
      publicJwk: zKmsJwkPublicAsymmetric,

      // never helps with type narrowing
      keyId: z.never().optional(),
    }),
  ]),

  /**
   * The JWA signature algorithm to use for verification
   */
  algorithm: zKnownJwaSignatureAlgorithm.describe('The JWA signature algorithm to use for verification'),

  /**
   * The data to verify
   */
  data: z.instanceof(Uint8Array).describe('The data to verify'),

  /**
   * The signature to verify the data against
   */
  signature: z.instanceof(Uint8Array).describe('The signature on the data to verify'),
})

export type KmsVerifyOptions = z.output<typeof zKmsVerifyOptions>

export type KmsVerifyReturn =
  | {
      verified: true
      publicJwk: KmsJwkPublic
    }
  | { verified: false }
