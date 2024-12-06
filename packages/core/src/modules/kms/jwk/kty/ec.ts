import * as v from '../../../../utils/valibot'
import { vJwkCommon } from '../jwk'

export const vKmsJwkPublicEc = v.object({
  ...vJwkCommon.entries,
  kty: v.literal('EC'),
  crv: v.picklist(['P-256', 'P-384', 'P-521', 'secp256k1', 'BLS12381G1', 'BLS12381G2']),

  // Public
  x: v.base64Url, // Public key x-coordinate
  y: v.base64Url, // Public key y-coordinate

  // Private
  d: v.optional(v.undefined()),
})
export type KmsJwkPublicEc = v.InferOutput<typeof vKmsJwkPublicEc>

export const vKmsJwkPrivateToPublicEc = v.object({
  ...vKmsJwkPublicEc.entries,
  d: v.optionalToUndefined(v.base64Url),
})

export const vKmsJwkPrivateEc = v.object({
  ...vKmsJwkPublicEc.entries,

  // Private
  d: v.base64Url,
})
export type KmsJwkPrivateEc = v.InferOutput<typeof vKmsJwkPrivateEc>
