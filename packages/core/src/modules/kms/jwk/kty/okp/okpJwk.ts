import * as z from '../../../../../utils/zod'
import { vJwkCommon } from '../../jwk'

// TODO: we should probably create a separate Jwk type for each crv, so we
// can use the type in Credo if we need a specific key
export const zKmsJwkPublicOkp = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('OKP'),
  crv: z.enum(['X25519', 'Ed25519']),

  // Public
  x: z.base64Url,

  // Private
  d: z.optional(z.base64Url),
})
export type KmsJwkPublicOkp = z.output<typeof zKmsJwkPublicOkp>

export const zKmsJwkPrivateToPublicOkp = z.object({
  ...zKmsJwkPublicOkp.shape,
  d: z.optionalToUndefined(z.base64Url),
})

export const zKmsJwkPrivateOkp = z.object({
  ...zKmsJwkPublicOkp.shape,

  // Private
  d: z.base64Url,
})
export type KmsJwkPrivateOkp = z.output<typeof zKmsJwkPrivateOkp>
