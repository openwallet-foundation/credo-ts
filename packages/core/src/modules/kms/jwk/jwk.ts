import * as z from '../../../utils/zod'

import { zJwkKeyOps, zJwkUse } from './keyOps'

export const vJwkCommon = z
  .object({
    kty: z.string(),
    kid: z.optional(z.string()),
    alg: z.optional(z.string()),

    key_ops: z.optional(zJwkKeyOps),
    use: z.optional(zJwkUse),

    ext: z.optional(z.boolean()),

    x5c: z.optional(z.array(z.string())),
    x5t: z.optional(z.string()),
    'x5t#S256': z.optional(z.string()),
    x5u: z.optional(z.string()),
  })
  .passthrough()
export type JwkCommon = z.output<typeof vJwkCommon>

// This can be used to verify the general structure matches
// without verifying any key type specific combinations (just
// that if e.g. x is present it should be a string)
export const vJwk = z
  .object({
    ...vJwkCommon.shape,

    // EC/OKP
    crv: z.optional(z.string()),
    x: z.optional(z.string()),
    d: z.optional(z.string()),

    // EC
    y: z.optional(z.string()),

    // oct
    k: z.optional(z.string()),

    // RSA
    e: z.optional(z.string()),
    n: z.optional(z.string()),
    dp: z.optional(z.string()),
    dq: z.optional(z.string()),
    oth: z.optional(
      z.array(
        z
          .object({
            d: z.optional(z.string()),
            r: z.optional(z.string()),
            t: z.optional(z.string()),
          })
          .passthrough()
      )
    ),
    p: z.optional(z.string()),
    q: z.optional(z.string()),
    qi: z.optional(z.string()),
  })
  .passthrough()
export type Jwk = z.output<typeof vJwk>
