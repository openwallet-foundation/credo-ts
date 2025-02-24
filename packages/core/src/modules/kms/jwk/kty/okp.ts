import * as z from '../../../../utils/zod'
import { vJwkCommon } from '../jwk'

export const vKmsJwkPublicOkp = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('OKP'),
  crv: z.enum(['X25519', 'Ed25519']),

  // Public
  x: z.base64Url,

  // Private
  d: z.optional(z.base64Url),
})
export type KmsJwkPublicOkp = z.output<typeof vKmsJwkPublicOkp>

export const vKmsJwkPrivateToPublicOkp = z.object({
  ...vKmsJwkPublicOkp.shape,
  d: z.optionalToUndefined(z.base64Url),
})

export const vKmsJwkPrivateOkp = z.object({
  ...vKmsJwkPublicOkp.shape,

  // Private
  d: z.base64Url,
})
export type KmsJwkPrivateOkp = z.output<typeof vKmsJwkPrivateOkp>
