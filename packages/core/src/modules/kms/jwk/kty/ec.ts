import * as z from '../../../../utils/zod'
import { vJwkCommon } from '../jwk'

export const vKmsJwkPublicEc = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('EC'),
  crv: z.enum(['P-256', 'P-384', 'P-521', 'secp256k1', 'BLS12381G1', 'BLS12381G2']),

  // Public
  x: z.base64Url, // Public key x-coordinate
  y: z.base64Url, // Public key y-coordinate

  // Private
  d: z.optional(z.undefined()),
})
export type KmsJwkPublicEc = z.output<typeof vKmsJwkPublicEc>

export const vKmsJwkPrivateToPublicEc = z.object({
  ...vKmsJwkPublicEc.shape,
  d: z.optionalToUndefined(z.base64Url),
})

export const vKmsJwkPrivateEc = z.object({
  ...vKmsJwkPublicEc.shape,

  // Private
  d: z.base64Url,
})
export type KmsJwkPrivateEc = z.output<typeof vKmsJwkPrivateEc>
