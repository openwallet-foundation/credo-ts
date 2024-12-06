import type { KnownJwaSignatureAlgorithm } from '../jwk/jwa'
import type { KmsJwkPublic, KmsJwkPublicAsymmetric } from '../jwk/knownJwk'

import * as v from '../../../utils/valibot'
import { vKnownJwaSignatureAlgorithm } from '../jwk/jwa'
import { vKmsJwkPublicAsymmetric } from '../jwk/knownJwk'

export const vKmsVerifyOptions = v.object({
  key: v.union([v.string(), vKmsJwkPublicAsymmetric]),

  algorithm: v.pipe(vKnownJwaSignatureAlgorithm, v.description('The JWA signature algorithm to use for verification')),

  data: v.pipe(v.instance(Uint8Array), v.description('The data to verify')),
  signature: v.pipe(v.instance(Uint8Array), v.description('The signature on the data to verify')),
})

// NOTE: we don't use the InferOutput here as it doesn't allow for JSDoc comments
export interface KmsVerifyOptions {
  /**
   * The key to verify with. Either a string referring to a keyId, or a `KmsJwkPublicAssymetric` for verifying with a
   * public asymmetric JWK.
   *
   * It is currently not possible to verify a signature with symmetric a
   * key that is not already present in the KMS.
   */
  key: string | KmsJwkPublicAsymmetric

  /**
   * The JWA signature algorithm to use for verification
   */
  algorithm: KnownJwaSignatureAlgorithm

  /**
   * The data to verify
   */
  data: Uint8Array

  /**
   * The signature to verify the data against
   */
  signature: Uint8Array
}

export type KmsVerifyReturn =
  | {
      verified: true
      publicJwk: KmsJwkPublic
    }
  | { verified: false }
