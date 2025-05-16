import * as z from '../../../../../utils/zod'
import { vJwkCommon } from '../../jwk'

export const zKmsJwkPublicEc = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('EC'),
  crv: z.enum(['P-256', 'P-384', 'P-521', 'secp256k1']),

  // Public
  x: z.base64Url, // Public key x-coordinate
  y: z.base64Url, // Public key y-coordinate

  // Private
  d: z.optional(z.undefined()),
})
export type KmsJwkPublicEc = z.output<typeof zKmsJwkPublicEc>

export const zKmsJwkPrivateToPublicEc = z.object({
  ...zKmsJwkPublicEc.shape,
  d: z.optionalToUndefined(z.base64Url),
})

export const zKmsJwkPrivateEc = z.object({
  ...zKmsJwkPublicEc.shape,

  // Private
  d: z.base64Url,
})
export type KmsJwkPrivateEc = z.output<typeof zKmsJwkPrivateEc>
