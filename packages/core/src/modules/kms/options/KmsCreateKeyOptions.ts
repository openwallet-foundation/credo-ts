import type { KmsJwkPublicFromCreateType } from '../jwk/knownJwk'

import * as z from '../../../utils/zod'
import { KnownJwaSignatureAlgorithm } from '../jwk'
import { zKnownJwaSignatureAlgorithm } from '../jwk/jwa'
import { zKmsJwkPublicEc } from '../jwk/kty/ec/ecJwk'
import { zKmsJwkPublicOct } from '../jwk/kty/oct/octJwk'
import { zKmsJwkPublicOkp } from '../jwk/kty/okp/okpJwk'
import { zKmsJwkPublicRsa } from '../jwk/kty/rsa/rsaJwk'
import { zKmsKeyId } from './common'

const zKmsCreateKeyTypeEc = zKmsJwkPublicEc.pick({ kty: true, crv: true })
export type KmsCreateKeyTypeEc = z.output<typeof zKmsCreateKeyTypeEc>

/**
 * Octer key pair, commonly used for Ed25519 and X25519 key types
 */
const zKmsCreateKeyTypeOkp = zKmsJwkPublicOkp.pick({ kty: true, crv: true })
export type KmsCreateKeyTypeOkp = z.output<typeof zKmsCreateKeyTypeOkp>

/**
 * RSA key pair.
 */
const zKmsCreateKeyTypeRsa = zKmsJwkPublicRsa.pick({ kty: true }).extend({
  modulusLength: z.union([z.literal(2048), z.literal(3072), z.literal(4096)]),
})
export type KmsCreateKeyTypeRsa = z.output<typeof zKmsCreateKeyTypeRsa>

/**
 * Represents an octect sequence for symmetric keys
 */
export const zKmsCreateKeyTypeOct = z.discriminatedUnion('algorithm', [
  z.object({
    kty: zKmsJwkPublicOct.shape.kty,
    algorithm: z.literal('aes'),
    length: z.union([
      z.literal(128),
      z.literal(192),
      z.literal(256),
      z
        .number()
        .int()
        .refine((length) => length % 8 === 0, 'aes key length must be multiple of 8'),
    ]),
  }),
  z.object({
    kty: zKmsJwkPublicOct.shape.kty,
    algorithm: z.literal('hmac').describe('For usage with HS256, HS384 and HS512'),
    length: z.union([z.literal(256), z.literal(384), z.literal(512)]),
  }),
  z.object({
    kty: zKmsJwkPublicOct.shape.kty,

    /**
     * For usage with ChaCha20-Poly1305 and XChaCha20-Poly1305
     */
    algorithm: z.literal('C20P').describe('For usage with ChaCha20-Poly1305 and XChaCha20-Poly1305'),
  }),
])
export type KmsCreateKeyTypeOct = z.output<typeof zKmsCreateKeyTypeOct>

export const zKmsCreateKeyTypeAssymetric = z.union([zKmsCreateKeyTypeEc, zKmsCreateKeyTypeOkp, zKmsCreateKeyTypeRsa])
export type KmsCreateKeyTypeAssymetric = z.output<typeof zKmsCreateKeyTypeAssymetric>

// TOOD: see if we can use nested discriminated union with zod?
export const zKmsCreateKeyType = z.union([
  zKmsCreateKeyTypeEc,
  zKmsCreateKeyTypeOkp,
  zKmsCreateKeyTypeRsa,
  zKmsCreateKeyTypeOct,
])
export type KmsCreateKeyType = z.output<typeof zKmsCreateKeyType>

export const zKmsCreateKeyOptions = z.object({
  keyId: z.optional(zKmsKeyId),
  type: zKmsCreateKeyType,
})

export interface KmsCreateKeyOptions<Type extends KmsCreateKeyType = KmsCreateKeyType> {
  /**
   * The `kid` for the key.
   */
  keyId?: string

  /**
   * The type of key to generate
   */
  type: Type
}

export const zKmsCreateKeyForSignatureAlgorithmOptions = z.object({
  keyId: z.optional(zKmsKeyId),
  algorithm: zKnownJwaSignatureAlgorithm,
})

export interface KmsCreateKeyForSignatureAlgorithmOptions {
  /**
   * The `kid` for the key.
   */
  keyId?: string

  /**
   * The JWA signature algorithm to create the key for.
   */
  algorithm: KnownJwaSignatureAlgorithm
}

export interface KmsCreateKeyReturn<Type extends KmsCreateKeyType = KmsCreateKeyType> {
  keyId: string

  /**
   * The public JWK representation of the created key. `kid` will always
   * be defined.
   *
   * In case of a symmetric (oct) key this won't include any key material, but
   * will include additional JWK claims such as `use`, `kty`, and `kid`
   */
  publicJwk: KmsJwkPublicFromCreateType<Type> & { kid: string }
}
