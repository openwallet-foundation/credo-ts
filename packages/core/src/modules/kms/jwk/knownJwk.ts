import * as z from '../../../utils/zod'

import { zKmsJwkPrivateEc, zKmsJwkPrivateToPublicEc, zKmsJwkPublicEc } from './kty/ec'
import { zKmsJwkPrivateOct, zKmsJwkPrivateToPublicOct, zKmsJwkPublicOct } from './kty/oct'
import { zKmsJwkPrivateOkp, zKmsJwkPrivateToPublicOkp, zKmsJwkPublicOkp } from './kty/okp'
import { zKmsJwkPrivateRsa, zKmsJwkPrivateToPublicRsa, zKmsJwkPublicRsa } from './kty/rsa'

export const zKmsJwkPublicAsymmetric = z.discriminatedUnion('kty', [
  zKmsJwkPublicEc,
  zKmsJwkPublicRsa,
  zKmsJwkPublicOkp,
])
export type KmsJwkPublicAsymmetric = z.output<typeof zKmsJwkPublicAsymmetric>

export const zKmsJwkPublicCrv = z.discriminatedUnion('kty', [zKmsJwkPublicEc, zKmsJwkPublicOkp])
export type KmsJwkPublicCrv = z.output<typeof zKmsJwkPublicCrv>

export const zKmsJwkPublic = z.discriminatedUnion('kty', [
  zKmsJwkPublicEc,
  zKmsJwkPublicRsa,
  zKmsJwkPublicOct,
  zKmsJwkPublicOkp,
])
export type KmsJwkPublic = z.output<typeof zKmsJwkPublic>

const zKmsJwkPrivateToPublic = z.discriminatedUnion('kty', [
  zKmsJwkPrivateToPublicEc,
  zKmsJwkPrivateToPublicRsa,
  zKmsJwkPrivateToPublicOct,
  zKmsJwkPrivateToPublicOkp,
])

export const zKmsJwkPrivateCrv = z.discriminatedUnion('kty', [zKmsJwkPrivateEc, zKmsJwkPrivateOkp])
export type KmsJwkPrivateCrv = z.output<typeof zKmsJwkPrivateCrv>

export const zKmsJwkPrivate = z.discriminatedUnion('kty', [
  zKmsJwkPrivateEc,
  zKmsJwkPrivateRsa,
  zKmsJwkPrivateOct,
  zKmsJwkPrivateOkp,
])
export type KmsJwkPrivate = z.output<typeof zKmsJwkPrivate>

export function publicJwkFromPrivateJwk(privateJwk: KmsJwkPrivate | KmsJwkPublic): KmsJwkPublic {
  // This will remove any private properties
  return z.parseWithErrorHandling(zKmsJwkPrivateToPublic, privateJwk)
}
