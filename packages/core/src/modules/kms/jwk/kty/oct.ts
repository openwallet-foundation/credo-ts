import * as v from '../../../../utils/valibot'
import { vJwkCommon } from '../jwk'

export const vKmsJwkPublicOct = v.object({
  ...vJwkCommon.entries,
  kty: v.literal('oct'),

  // Private
  k: v.optional(v.undefined()), // Key
})
export type KmsJwkPublicOct = v.InferOutput<typeof vKmsJwkPublicOct>

export const vKmsJwkPrivateToPublicOct = v.object({
  ...vKmsJwkPublicOct.entries,

  k: v.optionalToUndefined(v.base64Url), // Key
})

export const vKmsJwkPrivateOct = v.object({
  ...vKmsJwkPublicOct.entries,

  // Private
  k: v.base64Url, // Key
})
export type KmsJwkPrivateOct = v.InferOutput<typeof vKmsJwkPrivateOct>
