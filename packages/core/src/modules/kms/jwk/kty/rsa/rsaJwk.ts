import { z } from 'zod'
import { zBase64Url, zOptionalToUndefined } from '../../../../../utils/zod'
import { vJwkCommon } from '../../jwk'

const zKmsJwkPrivateRsaOth = z.array(
  z
    .object({
      d: z.optional(zBase64Url),
      r: z.optional(zBase64Url),
      t: z.optional(zBase64Url),
    })
    .loose()
)

export const zKmsJwkPublicRsa = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('RSA'),

  // Public
  n: zBase64Url, // Modulus
  e: zBase64Url, // Public exponent

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

  d: zOptionalToUndefined(zBase64Url), // Private exponent
  p: zOptionalToUndefined(zBase64Url), // First prime factor
  q: zOptionalToUndefined(zBase64Url), // Second prime factor
  dp: zOptionalToUndefined(zBase64Url), // First factor CRT exponent
  dq: zOptionalToUndefined(zBase64Url), // Second factor CRT exponent
  qi: zOptionalToUndefined(zBase64Url), // First CRT coefficient
  oth: zOptionalToUndefined(zKmsJwkPrivateRsaOth),
})

export const zKmsJwkPrivateRsa = z.object({
  ...zKmsJwkPublicRsa.shape,

  // Private
  d: zBase64Url, // Private exponent
  p: zBase64Url, // First prime factor
  q: zBase64Url, // Second prime factor
  dp: zBase64Url, // First factor CRT exponent
  dq: zBase64Url, // Second factor CRT exponent
  qi: zBase64Url, // First CRT coefficient
  oth: z.optional(zKmsJwkPrivateRsaOth),
})
export type KmsJwkPrivateRsa = z.output<typeof zKmsJwkPrivateRsa>
