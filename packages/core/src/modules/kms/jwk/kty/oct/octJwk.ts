import * as z from '../../../../../utils/zod'
import { vJwkCommon } from '../../jwk'

export const zKmsJwkPublicOct = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('oct'),

  // Private
  k: z.optional(z.undefined()), // Key
})
export type KmsJwkPublicOct = z.output<typeof zKmsJwkPublicOct>

export const zKmsJwkPrivateToPublicOct = z.object({
  ...zKmsJwkPublicOct.shape,

  k: z.optionalToUndefined(z.base64Url), // Key
})

export const zKmsJwkPrivateOct = z.object({
  ...zKmsJwkPublicOct.shape,

  // Private
  k: z.base64Url, // Key
})
export type KmsJwkPrivateOct = z.output<typeof zKmsJwkPrivateOct>
