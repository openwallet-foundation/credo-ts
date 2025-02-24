import type { KmsJwkPrivateOct } from '../jwk'

import * as z from '../../../utils/zod'
import { vKnownJwaContentEncryptionAlgorithms, vKnownJwaKeyEncryptionAlgorithms } from '../jwk/jwa'
import { vKmsJwkPrivateOct } from '../jwk/kty/oct'

// Key Wrapping with AES
// NOTE: we might want to extract this to a separate
// wrapKey method that only supports key wrapping algorithms
// but for now it's also possible to just do it using encrypt?
const vKmsEncryptKeyWrappingAesKw = z.object({
  algorithm: z.enum([
    vKnownJwaKeyEncryptionAlgorithms.A128KW.value,
    vKnownJwaKeyEncryptionAlgorithms.A192KW.value,
    vKnownJwaKeyEncryptionAlgorithms.A256KW.value,
  ]),
})
export type KmsEncryptKeyWrappingAesKw = z.output<typeof vKmsEncryptKeyWrappingAesKw>

const vKmsEncryptDataEncryptionAesGcm = z.object({
  // AES-GCM Content Encryption
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.A128GCM.value,
    vKnownJwaContentEncryptionAlgorithms.A192GCM.value,
    vKnownJwaContentEncryptionAlgorithms.A256GCM.value,
  ]),

  iv: z.optional(z.instanceof(Uint8Array).refine((iv) => iv.length === 12, `iv must be 12 bytes for AES GCM`)),
  aad: z.optional(z.instanceof(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesGcm = z.output<typeof vKmsEncryptDataEncryptionAesGcm>

// AES-CBC Content Encryption
const vKmsEncryptDataEncryptionAesCbc = z.object({
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.A128CBC.value,
    vKnownJwaContentEncryptionAlgorithms.A256CBC.value,
  ]),
  iv: z.optional(z.instanceof(Uint8Array).refine((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC`)),
})
export type KmsEncryptDataEncryptionAesCbc = z.output<typeof vKmsEncryptDataEncryptionAesCbc>

// AES-CBC with HMAC-SHA2 Content Encryption
const vKmsEncryptDataEncryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.A128CBC_HS256.value,
    vKnownJwaContentEncryptionAlgorithms.A192CBC_HS384.value,
    vKnownJwaContentEncryptionAlgorithms.A256CBC_HS512.value,
  ]),
  iv: z.optional(
    z.instanceof(Uint8Array).refine((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC with HMAC`)
  ),
  aad: z.optional(z.instanceof(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesCbcHmac = z.output<typeof vKmsEncryptDataEncryptionAesCbcHmac>

// ChaCha20-Poly130 Content Encryption
const vKmsEncryptDataEncryptionC20p = z.object({
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.C20P.value,
    vKnownJwaContentEncryptionAlgorithms.XC20P.value,
  ]),
  iv: z.optional(z.instanceof(Uint8Array)),
  aad: z.optional(z.instanceof(Uint8Array)),
})
// FIXME: if we use refine, we can't use discriminated union. and that makes the error handlnig shitty
// .refine(
//   ({ iv, algorithm }) => !iv || iv.length === (algorithm === 'C20P' ? 12 : 24),
//   `iv must be 12 bytes for C20P (ChaCha20-Poly1305) or 24 bytes for XC20P (XChaCha20-Poly1305)`
// )

export type KmsEncryptDataEncryptionX20c = z.output<typeof vKmsEncryptDataEncryptionC20p>

export const vKmsEncryptDataEncryption = z.discriminatedUnion('algorithm', [
  vKmsEncryptDataEncryptionAesCbc,
  vKmsEncryptDataEncryptionAesCbcHmac,
  vKmsEncryptDataEncryptionAesGcm,
  vKmsEncryptDataEncryptionC20p,
  vKmsEncryptKeyWrappingAesKw,
])
export type KmsEncryptDataEncryption = z.output<typeof vKmsEncryptDataEncryption>

export const vKmsEncryptOptions = z.object({
  /**
   * The key to use for encrypting.
   *
   * Either a key id reference or a private oct (symmetric) key jwk
   */
  key: z.union([z.string(), vKmsJwkPrivateOct]),

  /**
   * The encryption algorithm used to encrypt the data/content.
   * In JWE this parameter is referred to as "enc".
   */
  encryption: vKmsEncryptDataEncryption.describe(
    'Options related to the encryption algorithm to use for encrypting the data'
  ),

  /**
   * The data to encrypt
   */
  data: z.instanceof(Uint8Array).describe('The data to encrypt'),
})

export type KmsEncryptOptions = z.output<typeof vKmsEncryptOptions>
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
