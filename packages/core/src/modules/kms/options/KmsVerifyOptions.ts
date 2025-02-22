import type { KnownJwaSignatureAlgorithm } from '../jwk/jwa'
import type { KmsJwkPublic, KmsJwkPublicAsymmetric } from '../jwk/knownJwk'

import * as z from '../../../utils/zod'
import { vKnownJwaSignatureAlgorithm } from '../jwk/jwa'
import { vKmsJwkPublicAsymmetric } from '../jwk/knownJwk'

export const vKmsVerifyOptions = z.object({
  /**
   * The key to verify with. Either a string referring to a keyId, or a `KmsJwkPublicAssymetric` for verifying with a
   * public asymmetric JWK.
   *
   * It is currently not possible to verify a signature with symmetric a
   * key that is not already present in the KMS.
   */
  key: z.union([z.string(), vKmsJwkPublicAsymmetric]),

  /**
   * The JWA signature algorithm to use for verification
   */
  algorithm: vKnownJwaSignatureAlgorithm.describe('The JWA signature algorithm to use for verification'),

  /**
   * The data to verify
   */
  data: z.instanceof(Uint8Array).describe('The data to verify'),

  /**
   * The signature to verify the data against
   */
  signature: z.instanceof(Uint8Array).describe('The signature on the data to verify'),
})

export type KmsVerifyOptions = z.output<typeof vKmsVerifyOptions>

export type KmsVerifyReturn =
  | {
      verified: true
      publicJwk: KmsJwkPublic
    }
  | { verified: false }
