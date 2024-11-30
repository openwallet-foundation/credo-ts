import * as v from '../../../../utils/valibot'
import { vJwkCommon } from '../jwk'

export const vKmsJwkPublicOkp = v.object({
  ...vJwkCommon.entries,
  kty: v.literal('OKP'),
  crv: v.picklist(['X25519', 'Ed25519']),

  // Public
  x: v.base64Url,

  // Private
  d: v.optional(v.base64Url),
})
export type KmsJwkPublicOkp = v.InferOutput<typeof vKmsJwkPublicOkp>

export const vKmsJwkPrivateToPublicOkp = v.object({
  ...vKmsJwkPublicOkp.entries,
  d: v.optionalToUndefined(v.base64Url),
})

export const vKmsJwkPrivateOkp = v.object({
  ...vKmsJwkPublicOkp.entries,

  // Private
  d: v.base64Url,
})
export type KmsJwkPrivateOkp = v.InferOutput<typeof vKmsJwkPrivateOkp>
