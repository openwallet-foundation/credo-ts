import type { KmsJwkPublic } from '../jwk/knownJwk'
import type { KmsJwkPublicEc } from '../jwk/kty/ec'
import type { KmsJwkPublicOct } from '../jwk/kty/oct'
import type { KmsJwkPublicOkp } from '../jwk/kty/okp'
import type { KmsJwkPublicRsa } from '../jwk/kty/rsa'

import * as z from '../../../utils/zod'
import { vKmsJwkPublicEc } from '../jwk/kty/ec'
import { vKmsJwkPublicOct } from '../jwk/kty/oct'
import { vKmsJwkPublicOkp } from '../jwk/kty/okp'
import { vKmsJwkPublicRsa } from '../jwk/kty/rsa'

const vKmsCreateKeyTypeEc = vKmsJwkPublicEc.pick({ kty: true, crv: true })
export type KmsCreateKeyTypeEc = z.output<typeof vKmsCreateKeyTypeEc>

/**
 * Octer key pair, commonly used for Ed25519 and X25519 key types
 */
const vKmsCreateKeyTypeOkp = vKmsJwkPublicOkp.pick({ kty: true, crv: true })
export type KmsCreateKeyTypeOkp = z.output<typeof vKmsCreateKeyTypeOkp>

/**
 * RSA key pair.
 */
const vKmsCreateKeyTypeRsa = vKmsJwkPublicRsa.pick({ kty: true }).extend({
  modulusLength: z.union([z.literal(2048), z.literal(3072), z.literal(4096)]),
})
export type KmsCreateKeyTypeRsa = z.output<typeof vKmsCreateKeyTypeRsa>

/**
 * Represents an octect sequence for symmetric keys
 */
export const vKmsCreateKeyTypeOct = z.discriminatedUnion('algorithm', [
  z.object({
    kty: vKmsJwkPublicOct.shape.kty,
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
    kty: vKmsJwkPublicOct.shape.kty,
    algorithm: z.literal('hmac').describe('For usage with HS256, HS384 and HS512'),
    length: z.union([z.literal(256), z.literal(384), z.literal(512)]),
  }),
  z.object({
    kty: vKmsJwkPublicOct.shape.kty,
    algorithm: z.literal('c20p').describe('For usage with ChaCha20-Poly1305 and XChaCha20-Poly1305'),
  }),
])
export type KmsCreateKeyTypeOct = z.output<typeof vKmsCreateKeyTypeOct>

// TOOD: see if we can use nested discriminated union with zod?
export const vKmsCreateKeyType = z.union([
  vKmsCreateKeyTypeEc,
  vKmsCreateKeyTypeOkp,
  vKmsCreateKeyTypeRsa,
  vKmsCreateKeyTypeOct,
])
export type KmsCreateKeyType = z.output<typeof vKmsCreateKeyType>

export const vKmsCreateKeyOptions = z.object({
  keyId: z.optional(z.string()),
  type: vKmsCreateKeyType,
})

export interface KmsCreateKeyOptions<Type extends KmsCreateKeyType = KmsCreateKeyType> {
  /**
   * The `kid` for the key. If not provided the public key will be used as the key id
   */
  keyId?: string

  /**
   * The type of key to generate
   */
  type: Type
}

export type KmsJwkPublicFromCreateType<Type extends KmsCreateKeyType> = Type extends KmsCreateKeyTypeRsa
  ? KmsJwkPublicRsa
  : Type extends KmsCreateKeyTypeOct
  ? KmsJwkPublicOct
  : Type extends KmsCreateKeyTypeOkp
  ? KmsJwkPublicOkp & { crv: Type['crv'] }
  : Type extends KmsCreateKeyTypeEc
  ? KmsJwkPublicEc & { crv: Type['crv'] }
  : KmsJwkPublic

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
