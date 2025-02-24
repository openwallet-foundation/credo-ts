import * as z from '../../../utils/zod'

import { vKmsJwkPrivateEc, vKmsJwkPrivateToPublicEc, vKmsJwkPublicEc } from './kty/ec'
import { vKmsJwkPrivateOct, vKmsJwkPrivateToPublicOct, vKmsJwkPublicOct } from './kty/oct'
import { vKmsJwkPrivateOkp, vKmsJwkPrivateToPublicOkp, vKmsJwkPublicOkp } from './kty/okp'
import { vKmsJwkPrivateRsa, vKmsJwkPrivateToPublicRsa, vKmsJwkPublicRsa } from './kty/rsa'

export const vKmsJwkPublicAsymmetric = z.discriminatedUnion('kty', [
  vKmsJwkPublicEc,
  vKmsJwkPublicRsa,
  vKmsJwkPublicOkp,
])
export type KmsJwkPublicAsymmetric = z.output<typeof vKmsJwkPublicAsymmetric>

export const vKmsJwkPublicCrv = z.discriminatedUnion('kty', [vKmsJwkPublicEc, vKmsJwkPublicOkp])
export type KmsJwkPublicCrv = z.output<typeof vKmsJwkPublicCrv>

export const vKmsJwkPublic = z.discriminatedUnion('kty', [
  vKmsJwkPublicEc,
  vKmsJwkPublicRsa,
  vKmsJwkPublicOct,
  vKmsJwkPublicOkp,
])
export type KmsJwkPublic = z.output<typeof vKmsJwkPublic>

const vKmsJwkPrivateToPublic = z.discriminatedUnion('kty', [
  vKmsJwkPrivateToPublicEc,
  vKmsJwkPrivateToPublicRsa,
  vKmsJwkPrivateToPublicOct,
  vKmsJwkPrivateToPublicOkp,
])

export const vKmsJwkPrivateCrv = z.discriminatedUnion('kty', [vKmsJwkPrivateEc, vKmsJwkPrivateOkp])
export type KmsJwkPrivateCrv = z.output<typeof vKmsJwkPrivateCrv>

export const vKmsJwkPrivate = z.discriminatedUnion('kty', [
  vKmsJwkPrivateEc,
  vKmsJwkPrivateRsa,
  vKmsJwkPrivateOct,
  vKmsJwkPrivateOkp,
])
export type KmsJwkPrivate = z.output<typeof vKmsJwkPrivate>

export function publicJwkFromPrivateJwk(privateJwk: KmsJwkPrivate | KmsJwkPublic): KmsJwkPublic {
  // This will remove any private properties
  return z.parseWithErrorHandling(vKmsJwkPrivateToPublic, privateJwk)
}
