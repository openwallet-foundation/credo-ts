import * as v from '../../../utils/valibot'

import { vJwkKeyOps, vJwkUse } from './keyOps'

export const vJwkCommon = v.looseObject({
  kty: v.string(),
  kid: v.optional(v.string()),
  alg: v.optional(v.string()),

  key_ops: v.optional(vJwkKeyOps),
  use: v.optional(vJwkUse),

  ext: v.optional(v.boolean()),

  x5c: v.optional(v.string()),
  x5t: v.optional(v.string()),
  'x5t#S256': v.optional(v.string()),
  x5u: v.optional(v.string()),
})
export type JwkCommon = v.InferOutput<typeof vJwkCommon>

// This can be used to verify the general structure matches
// without verifying any key type specific combinations (just
// that if e.g. x is present it should be a string)
export const vJwk = v.looseObject({
  ...vJwkCommon.entries,

  // EC/OKP
  crv: v.optional(v.string()),
  x: v.optional(v.string()),
  d: v.optional(v.string()),

  // EC
  y: v.optional(v.string()),

  // oct
  k: v.optional(v.string()),

  // RSA
  e: v.optional(v.string()),
  n: v.optional(v.string()),
  dp: v.optional(v.string()),
  dq: v.optional(v.string()),
  oth: v.optional(
    v.array(
      v.looseObject({
        d: v.optional(v.string()),
        r: v.optional(v.string()),
        t: v.optional(v.string()),
      })
    )
  ),
  p: v.optional(v.string()),
  q: v.optional(v.string()),
  qi: v.optional(v.string()),
})
export type Jwk = v.InferOutput<typeof vJwk>
