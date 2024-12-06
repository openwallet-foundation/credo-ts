import * as v from '../../../utils/valibot'

import { vKmsJwkPrivateEc, vKmsJwkPrivateToPublicEc, vKmsJwkPublicEc } from './kty/ec'
import { vKmsJwkPrivateOct, vKmsJwkPrivateToPublicOct, vKmsJwkPublicOct } from './kty/oct'
import { vKmsJwkPrivateOkp, vKmsJwkPrivateToPublicOkp, vKmsJwkPublicOkp } from './kty/okp'
import { vKmsJwkPrivateRsa, vKmsJwkPrivateToPublicRsa, vKmsJwkPublicRsa } from './kty/rsa'

export const vKmsJwkPublicAsymmetric = v.variant('kty', [vKmsJwkPublicEc, vKmsJwkPublicRsa, vKmsJwkPublicOkp])
export type KmsJwkPublicAsymmetric = v.InferOutput<typeof vKmsJwkPublicAsymmetric>

export const vKmsJwkPublicCrv = v.variant('kty', [vKmsJwkPublicEc, vKmsJwkPublicOkp])
export type KmsJwkPublicCrv = v.InferOutput<typeof vKmsJwkPublicCrv>

export const vKmsJwkPublic = v.variant('kty', [vKmsJwkPublicEc, vKmsJwkPublicRsa, vKmsJwkPublicOct, vKmsJwkPublicOkp])
export type KmsJwkPublic = v.InferOutput<typeof vKmsJwkPublic>

const vKmsJwkPrivateToPublic = v.variant('kty', [
  vKmsJwkPrivateToPublicEc,
  vKmsJwkPrivateToPublicRsa,
  vKmsJwkPrivateToPublicOct,
  vKmsJwkPrivateToPublicOkp,
])

export const vKmsJwkPrivateCrv = v.variant('kty', [vKmsJwkPrivateEc, vKmsJwkPrivateOkp])
export type KmsJwkPrivateCrv = v.InferOutput<typeof vKmsJwkPrivateCrv>

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
