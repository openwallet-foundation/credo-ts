import * as z from '../../../../utils/zod'
import { vJwkCommon } from '../jwk'

export const vKmsJwkPublicOct = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('oct'),

  // Private
  k: z.optional(z.undefined()), // Key
})
export type KmsJwkPublicOct = z.output<typeof vKmsJwkPublicOct>

export const vKmsJwkPrivateToPublicOct = z.object({
  ...vKmsJwkPublicOct.shape,

  k: z.optionalToUndefined(z.base64Url), // Key
})

export const vKmsJwkPrivateOct = z.object({
  ...vKmsJwkPublicOct.shape,

  // Private
  k: z.base64Url, // Key
})
export type KmsJwkPrivateOct = z.output<typeof vKmsJwkPrivateOct>
