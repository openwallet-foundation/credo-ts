import * as v from '../../../utils/valibot'

import { vKmsJwkPrivateEc, vKmsJwkPrivateToPublicEc, vKmsJwkPublicEc } from './kty/ec'
import { vKmsJwkPrivateOct, vKmsJwkPrivateToPublicOct, vKmsJwkPublicOct } from './kty/oct'
import { vKmsJwkPrivateOkp, vKmsJwkPrivateToPublicOkp, vKmsJwkPublicOkp } from './kty/okp'
import { vKmsJwkPrivateRsa, vKmsJwkPrivateToPublicRsa, vKmsJwkPublicRsa } from './kty/rsa'

export const vKmsJwkPublic = v.variant('kty', [vKmsJwkPublicEc, vKmsJwkPublicRsa, vKmsJwkPublicOct, vKmsJwkPublicOkp])
export type KmsJwkPublic = v.InferOutput<typeof vKmsJwkPublic>

const vKmsJwkPrivateToPublic = v.variant('kty', [
  vKmsJwkPrivateToPublicEc,
  vKmsJwkPrivateToPublicRsa,
  vKmsJwkPrivateToPublicOct,
  vKmsJwkPrivateToPublicOkp,
])

export const vKmsJwkPrivate = v.variant('kty', [
  vKmsJwkPrivateEc,
  vKmsJwkPrivateRsa,
  vKmsJwkPrivateOct,
  vKmsJwkPrivateOkp,
])
export type KmsJwkPrivate = v.InferOutput<typeof vKmsJwkPrivate>

export function publicJwkFromPrivateJwk(privateJwk: KmsJwkPrivate | KmsJwkPublic): KmsJwkPublic {
  // This will remove any private properties
  return v.parseWithErrorHandling(vKmsJwkPrivateToPublic, privateJwk)
}
