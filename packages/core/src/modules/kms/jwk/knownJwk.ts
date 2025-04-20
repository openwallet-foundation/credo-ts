import * as z from '../../../utils/zod'
import { KeyManagementError } from '../error/KeyManagementError'

import { zKmsJwkPrivateEc, zKmsJwkPrivateToPublicEc, zKmsJwkPublicEc } from './kty/ec/ecJwk'
import { zKmsJwkPrivateOct, zKmsJwkPrivateToPublicOct, zKmsJwkPublicOct } from './kty/oct/octJwk'
import { zKmsJwkPrivateOkp, zKmsJwkPrivateToPublicOkp, zKmsJwkPublicOkp } from './kty/okp/okpJwk'
import { zKmsJwkPrivateRsa, zKmsJwkPrivateToPublicRsa, zKmsJwkPublicRsa } from './kty/rsa/rsaJwk'

export const zKmsJwkPublicAsymmetric = z.discriminatedUnion('kty', [
  zKmsJwkPublicEc,
  zKmsJwkPublicRsa,
  zKmsJwkPublicOkp,
])
export type KmsJwkPublicAsymmetric = z.output<typeof zKmsJwkPublicAsymmetric>

export function isJwkAsymmetric(
  jwk: KmsJwkPublic | KmsJwkPrivate
): jwk is KmsJwkPrivateAsymmetric | KmsJwkPublicAsymmetric {
  return jwk.kty !== 'oct'
}

export function assertJwkAsymmetric(
  jwk: KmsJwkPublic | KmsJwkPrivate,
  keyId?: string
): asserts jwk is KmsJwkPublicAsymmetric | KmsJwkPrivateAsymmetric {
  if (!isJwkAsymmetric(jwk)) {
    if (keyId) {
      throw new KeyManagementError(`Expected jwk with keyId ${keyId} to be an assymetric jwk, but found kty 'oct'`)
    }
    throw new KeyManagementError("Expected jwk to be an assymetric jwk, but found kty 'oct'")
  }
}

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

export const zKmsJwkPrivateAsymmetric = z.discriminatedUnion('kty', [
  zKmsJwkPrivateEc,
  zKmsJwkPrivateRsa,
  zKmsJwkPrivateOkp,
])
export type KmsJwkPrivateAsymmetric = z.output<typeof zKmsJwkPrivateAsymmetric>

export function publicJwkFromPrivateJwk(privateJwk: KmsJwkPrivate | KmsJwkPublic): KmsJwkPublic {
  // This will remove any private properties
  return z.parseWithErrorHandling(zKmsJwkPrivateToPublic, privateJwk)
}
