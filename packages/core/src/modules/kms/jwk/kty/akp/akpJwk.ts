import { z } from 'zod'
import { zBase64Url, zOptionalToUndefined } from '../../../../../utils/zod'
import { vJwkCommon } from '../../jwk'

export const zKmsJwkPublicAkp = z.object({
  ...vJwkCommon.shape,
  kty: z.literal('AKP'),
  alg: z.enum(['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87']),
  crv: z.never().optional(),
  x: z.never().optional(),
  d: z.never().optional(),
  pub: zBase64Url,
  priv: z.optional(z.undefined()),
})
export type KmsJwkPublicAkp = z.output<typeof zKmsJwkPublicAkp>

export const zKmsJwkPrivateToPublicAkp = z.object({
  ...zKmsJwkPublicAkp.shape,
  priv: zOptionalToUndefined(zBase64Url),
})

export const zKmsJwkPrivateAkp = z.object({
  ...zKmsJwkPublicAkp.shape,
  priv: zBase64Url,
})
export type KmsJwkPrivateAkp = z.output<typeof zKmsJwkPrivateAkp>
