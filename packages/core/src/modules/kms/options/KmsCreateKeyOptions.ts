import type { KmsJwkPublic } from '../jwk/knownJwk'
import type { KmsJwkPublicEc } from '../jwk/kty/ec'
import type { KmsJwkPublicOct } from '../jwk/kty/oct'
import type { KmsJwkPublicOkp } from '../jwk/kty/okp'
import type { KmsJwkPublicRsa } from '../jwk/kty/rsa'

import * as v from '../../../utils/valibot'
import { vKmsJwkPublicEc } from '../jwk/kty/ec'
import { vKmsJwkPublicOct } from '../jwk/kty/oct'
import { vKmsJwkPublicOkp } from '../jwk/kty/okp'
import { vKmsJwkPublicRsa } from '../jwk/kty/rsa'

const vKmsCreateKeyTypeEc = v.pick(vKmsJwkPublicEc, ['kty', 'crv'])
export type KmsCreateKeyTypeEc = v.InferOutput<typeof vKmsCreateKeyTypeEc>

/**
 * Octer key pair, commonly used for Ed25519 and X25519 key types
 */
const vKmsCreateKeyTypeOkp = v.pick(vKmsJwkPublicOkp, ['kty', 'crv'])
export type KmsCreateKeyTypeOkp = v.InferOutput<typeof vKmsCreateKeyTypeOkp>

/**
 * RSA key pair.
 */
const vKmsCreateKeyTypeRsa = v.object({
  ...v.pick(vKmsJwkPublicRsa, ['kty']).entries,
  modulusLength: v.pipe(v.picklist([2048, 3072, 4096])),
})
export type KmsCreateKeyTypeRsa = v.InferOutput<typeof vKmsCreateKeyTypeRsa>

/**
 * Represents an octect sequence for symmetric keys
 */
export const vKmsCreateKeyTypeOct = v.variant('algorithm', [
  v.object({
    kty: vKmsJwkPublicOct.entries.kty,
    algorithm: v.literal('aes'),
    length: v.union([
      v.literal(128),
      v.literal(192),
      v.literal(256),
      v.pipe(
        v.number(),
        v.integer(),
        v.check((length) => length % 8 === 0, 'aes key length must be multiple of 8')
      ),
    ]),
  }),
  v.object({
    kty: vKmsJwkPublicOct.entries.kty,
    algorithm: v.pipe(v.literal('hmac'), v.description('For usage with HS256, HS384 and HS512')),
    length: v.picklist([256, 384, 512]),
  }),
  v.object({
    kty: vKmsJwkPublicOct.entries.kty,
    algorithm: v.pipe(v.literal('c20p'), v.description('For usage with ChaCha20-Poly1305 and XChaCha20-Poly1305')),
  }),
])
export type KmsCreateKeyTypeOct = v.InferOutput<typeof vKmsCreateKeyTypeOct>

export const vKmsCreateKeyType = v.variant('kty', [
  vKmsCreateKeyTypeEc,
  vKmsCreateKeyTypeOkp,
  vKmsCreateKeyTypeRsa,
  vKmsCreateKeyTypeOct,
])
export type KmsCreateKeyType = v.InferOutput<typeof vKmsCreateKeyType>

export const vKmsCreateKeyOptions = v.object({
  keyId: v.optional(v.string()),
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
