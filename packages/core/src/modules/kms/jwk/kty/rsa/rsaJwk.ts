import * as z from '../../../../../utils/zod'
import { vJwkCommon } from '../../jwk'

const zKmsJwkPrivateRsaOth = z.array(
  z
    .object({
      d: z.optional(z.base64Url),
      r: z.optional(z.base64Url),
      t: z.optional(z.base64Url),
    })
    .passthrough()
)

export const zKmsJwkPublicRsa = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('RSA'),

  // Public
  n: z.base64Url, // Modulus
  e: z.base64Url, // Public exponent

  // Private
  d: z.optional(z.undefined()), // Private exponent
  p: z.optional(z.undefined()), // First prime factor
  q: z.optional(z.undefined()), // Second prime factor
  dp: z.optional(z.undefined()), // First factor CRT exponent
  dq: z.optional(z.undefined()), // Second factor CRT exponent
  qi: z.optional(z.undefined()), // First CRT coefficient
  oth: z.optional(z.undefined()),
})
export type KmsJwkPublicRsa = z.output<typeof zKmsJwkPublicRsa>

export const zKmsJwkPrivateToPublicRsa = z.object({
  ...zKmsJwkPublicRsa.shape,

  d: z.optionalToUndefined(z.base64Url), // Private exponent
  p: z.optionalToUndefined(z.base64Url), // First prime factor
  q: z.optionalToUndefined(z.base64Url), // Second prime factor
  dp: z.optionalToUndefined(z.base64Url), // First factor CRT exponent
  dq: z.optionalToUndefined(z.base64Url), // Second factor CRT exponent
  qi: z.optionalToUndefined(z.base64Url), // First CRT coefficient
  oth: z.optionalToUndefined(zKmsJwkPrivateRsaOth),
})

export const zKmsJwkPrivateRsa = z.object({
  ...zKmsJwkPublicRsa.shape,

  // Private
  d: z.base64Url, // Private exponent
  p: z.base64Url, // First prime factor
  q: z.base64Url, // Second prime factor
  dp: z.base64Url, // First factor CRT exponent
  dq: z.base64Url, // Second factor CRT exponent
  qi: z.base64Url, // First CRT coefficient
  oth: z.optional(zKmsJwkPrivateRsaOth),
})
export type KmsJwkPrivateRsa = z.output<typeof zKmsJwkPrivateRsa>
