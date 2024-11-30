import * as v from '../../../../utils/valibot'
import { vJwkCommon } from '../jwk'

const vKmsJwkPrivateRsaOth = v.array(
  v.looseObject({
    d: v.optional(v.base64Url),
    r: v.optional(v.base64Url),
    t: v.optional(v.base64Url),
  })
)

export const vKmsJwkPublicRsa = v.object({
  ...vJwkCommon.entries,
  kty: v.literal('RSA'),

  // Public
  n: v.base64Url, // Modulus
  e: v.base64Url, // Public exponent

  // Private
  d: v.optional(v.undefined()), // Private exponent
  p: v.optional(v.undefined()), // First prime factor
  q: v.optional(v.undefined()), // Second prime factor
  dp: v.optional(v.undefined()), // First factor CRT exponent
  dq: v.optional(v.undefined()), // Second factor CRT exponent
  qi: v.optional(v.undefined()), // First CRT coefficient
  oth: v.optional(v.undefined()),
})
export type KmsJwkPublicRsa = v.InferOutput<typeof vKmsJwkPublicRsa>

export const vKmsJwkPrivateToPublicRsa = v.object({
  ...vKmsJwkPublicRsa.entries,

  d: v.optionalToUndefined(v.base64Url), // Private exponent
  p: v.optionalToUndefined(v.base64Url), // First prime factor
  q: v.optionalToUndefined(v.base64Url), // Second prime factor
  dp: v.optionalToUndefined(v.base64Url), // First factor CRT exponent
  dq: v.optionalToUndefined(v.base64Url), // Second factor CRT exponent
  qi: v.optionalToUndefined(v.base64Url), // First CRT coefficient
  oth: v.optionalToUndefined(vKmsJwkPrivateRsaOth),
})

export const vKmsJwkPrivateRsa = v.object({
  ...vKmsJwkPublicRsa.entries,

  // Private
  d: v.base64Url, // Private exponent
  p: v.base64Url, // First prime factor
  q: v.base64Url, // Second prime factor
  dp: v.base64Url, // First factor CRT exponent
  dq: v.base64Url, // Second factor CRT exponent
  qi: v.base64Url, // First CRT coefficient
  oth: v.optional(vKmsJwkPrivateRsaOth),
})
export type KmsJwkPrivateRsa = v.InferOutput<typeof vKmsJwkPrivateRsa>
