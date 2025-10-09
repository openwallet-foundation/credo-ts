import { z } from 'zod'
import { KeyManagementError } from '../error/KeyManagementError'
import type {
  KmsCreateKeyType,
  KmsCreateKeyTypeEc,
  KmsCreateKeyTypeOct,
  KmsCreateKeyTypeOkp,
  KmsCreateKeyTypeRsa,
} from '../options'

import { zParseWithErrorHandling } from '../../../utils/zod'
import {
  type KmsJwkPrivateEc,
  type KmsJwkPublicEc,
  zKmsJwkPrivateEc,
  zKmsJwkPrivateToPublicEc,
  zKmsJwkPublicEc,
} from './kty/ec/ecJwk'
import {
  type KmsJwkPrivateOct,
  type KmsJwkPublicOct,
  zKmsJwkPrivateOct,
  zKmsJwkPrivateToPublicOct,
  zKmsJwkPublicOct,
} from './kty/oct/octJwk'
import {
  type KmsJwkPrivateOkp,
  type KmsJwkPublicOkp,
  zKmsJwkPrivateOkp,
  zKmsJwkPrivateToPublicOkp,
  zKmsJwkPublicOkp,
} from './kty/okp/okpJwk'
import {
  type KmsJwkPrivateRsa,
  type KmsJwkPublicRsa,
  zKmsJwkPrivateRsa,
  zKmsJwkPrivateToPublicRsa,
  zKmsJwkPublicRsa,
} from './kty/rsa/rsaJwk'

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

const zKmsJwkPrivateToPublic = z
  .discriminatedUnion('kty', [
    zKmsJwkPrivateToPublicEc,
    zKmsJwkPrivateToPublicRsa,
    zKmsJwkPrivateToPublicOct,
    zKmsJwkPrivateToPublicOkp,
  ])
  // Mdoc library does not work well with undefined values. It should not be needed
  // but for now it's the easiest approach
  .transform(
    (jwk): KmsJwkPublic =>
      Object.fromEntries(Object.entries(jwk).filter(([, value]) => value !== undefined)) as KmsJwkPublic
  )

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
  return zParseWithErrorHandling(zKmsJwkPrivateToPublic, privateJwk)
}

export type KmsJwkPrivateFromKmsJwkPublic<Type extends KmsCreateKeyType> = Type extends KmsCreateKeyTypeRsa
  ? KmsJwkPrivateRsa
  : Type extends KmsCreateKeyTypeOct
    ? KmsJwkPrivateOct
    : Type extends KmsCreateKeyTypeOkp
      ? KmsJwkPrivateOkp & { crv: Type['crv'] }
      : Type extends KmsCreateKeyTypeEc
        ? KmsJwkPrivateEc & { crv: Type['crv'] }
        : KmsJwkPrivate

export type KmsJwkPublicFromKmsJwkPrivate<Jwk extends KmsJwkPrivate> = Jwk extends KmsJwkPrivateRsa
  ? KmsJwkPublicRsa
  : Jwk extends KmsJwkPrivateOct
    ? KmsJwkPublicOct
    : Jwk extends KmsJwkPrivateOkp
      ? KmsJwkPublicOkp & { crv: Jwk['crv'] }
      : Jwk extends KmsJwkPrivateEc
        ? KmsJwkPublicEc & { crv: Jwk['crv'] }
        : KmsJwkPublic

export type KmsJwkPublicFromCreateType<Type extends KmsCreateKeyType> = Type extends KmsCreateKeyTypeRsa
  ? KmsJwkPublicRsa
  : Type extends KmsCreateKeyTypeOct
    ? KmsJwkPublicOct
    : Type extends KmsCreateKeyTypeOkp
      ? KmsJwkPublicOkp & { crv: Type['crv'] }
      : Type extends KmsCreateKeyTypeEc
        ? KmsJwkPublicEc & { crv: Type['crv'] }
        : KmsJwkPublic
