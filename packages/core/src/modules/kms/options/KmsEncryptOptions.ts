import * as z from '../../../utils/zod'
import { vKnownJwaKeyEncryptionAlgorithms, zKnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct'

// Key Wrapping with AES
// NOTE: we might want to extract this to a separate
// wrapKey method that only supports key wrapping algorithms
// but for now it's also possible to just do it using encrypt?
const zKmsEncryptKeyWrappingAesKw = z.object({
  algorithm: z.enum([
    vKnownJwaKeyEncryptionAlgorithms.A128KW.value,
    vKnownJwaKeyEncryptionAlgorithms.A192KW.value,
    vKnownJwaKeyEncryptionAlgorithms.A256KW.value,
  ]),
})
export type KmsEncryptKeyWrappingAesKw = z.output<typeof zKmsEncryptKeyWrappingAesKw>

const zKmsEncryptDataEncryptionAesGcm = z.object({
  // AES-GCM Content Encryption
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.A128GCM.value,
    zKnownJwaContentEncryptionAlgorithms.A192GCM.value,
    zKnownJwaContentEncryptionAlgorithms.A256GCM.value,
  ]),

  iv: z.optional(z.instanceof(Uint8Array).refine((iv) => iv.length === 12, 'iv must be 12 bytes for AES GCM')),
  aad: z.optional(z.instanceof(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesGcm = z.output<typeof zKmsEncryptDataEncryptionAesGcm>

// AES-CBC Content Encryption
const zKmsEncryptDataEncryptionAesCbc = z.object({
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.A128CBC.value,
    zKnownJwaContentEncryptionAlgorithms.A256CBC.value,
  ]),
  iv: z.optional(z.instanceof(Uint8Array).refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC')),
})
export type KmsEncryptDataEncryptionAesCbc = z.output<typeof zKmsEncryptDataEncryptionAesCbc>

// AES-CBC with HMAC-SHA2 Content Encryption
const zKmsEncryptDataEncryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.A128CBC_HS256.value,
    zKnownJwaContentEncryptionAlgorithms.A192CBC_HS384.value,
    zKnownJwaContentEncryptionAlgorithms.A256CBC_HS512.value,
  ]),
  iv: z.optional(
    z.instanceof(Uint8Array).refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC with HMAC')
  ),
  aad: z.optional(z.instanceof(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesCbcHmac = z.output<typeof zKmsEncryptDataEncryptionAesCbcHmac>

// ChaCha20-Poly130 Content Encryption
const zKmsEncryptDataEncryptionC20p = z.object({
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.C20P.value,
    zKnownJwaContentEncryptionAlgorithms.XC20P.value,
  ]),
  iv: z.optional(z.instanceof(Uint8Array)),
  aad: z.optional(z.instanceof(Uint8Array)),
})
// FIXME: if we use refine, we can't use discriminated union. and that makes the error handlnig shitty
// .refine(
//   ({ iv, algorithm }) => !iv || iv.length === (algorithm === 'C20P' ? 12 : 24),
//   `iv must be 12 bytes for C20P (ChaCha20-Poly1305) or 24 bytes for XC20P (XChaCha20-Poly1305)`
// )

export type KmsEncryptDataEncryptionX20c = z.output<typeof zKmsEncryptDataEncryptionC20p>

export const zKmsEncryptDataEncryption = z.discriminatedUnion('algorithm', [
  zKmsEncryptDataEncryptionAesCbc,
  zKmsEncryptDataEncryptionAesCbcHmac,
  zKmsEncryptDataEncryptionAesGcm,
  zKmsEncryptDataEncryptionC20p,
  zKmsEncryptKeyWrappingAesKw,
])
export type KmsEncryptDataEncryption = z.output<typeof zKmsEncryptDataEncryption>

export const zKmsEncryptOptions = z.object({
  /**
   * The key to use for encrypting.
   *
   * Either a key id reference or a private oct (symmetric) key jwk
   */
  key: z.union([z.string(), zKmsJwkPrivateOct]),

  /**
   * The encryption algorithm used to encrypt the data/content.
   * In JWE this parameter is referred to as "enc".
   */
  encryption: zKmsEncryptDataEncryption.describe(
    'Options related to the encryption algorithm to use for encrypting the data'
  ),

  /**
   * The data to encrypt
   */
  data: z.instanceof(Uint8Array).describe('The data to encrypt'),
})

export type KmsEncryptOptions = z.output<typeof zKmsEncryptOptions>
export interface KmsEncryptReturn {
  /**
   * The encrypted data, also known as "ciphertext" in JWE
   */
  encrypted: Uint8Array

  /**
   * Optional authentication tag
   */
  tag?: Uint8Array

  /**
   * The initialization vector. For algorithms where the iv is required
   * and not provided, this will contain the auto-generated value.
   */
  iv?: Uint8Array
}
