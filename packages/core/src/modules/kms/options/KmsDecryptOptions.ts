import * as z from '../../../utils/zod'
import { zKnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct'

const zKmsDecryptDataDecryptionAesGcm = z.object({
  // AES-GCM Content Decryption
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.A128GCM.value,
    zKnownJwaContentEncryptionAlgorithms.A192GCM.value,
    zKnownJwaContentEncryptionAlgorithms.A256GCM.value,
  ]),

  iv: z.instanceof(Uint8Array).refine((iv) => iv.length === 12, 'iv must be 12 bytes for AES GCM'),
  aad: z.optional(z.instanceof(Uint8Array)),
  tag: z.instanceof(Uint8Array),
})
export type KmsDecryptDataDecryptionAesGcm = z.output<typeof zKmsDecryptDataDecryptionAesGcm>

// AES-CBC Content Decryption
const zKmsDecryptDataDecryptionAesCbc = z.object({
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.A128CBC.value,
    zKnownJwaContentEncryptionAlgorithms.A256CBC.value,
  ]),
  iv: z.instanceof(Uint8Array).refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC'),
})
export type KmsDecryptDataDecryptionAesCbc = z.output<typeof zKmsDecryptDataDecryptionAesCbc>

// AES-CBC Content Decryption
const zKmsDecryptDataDecryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.A128CBC_HS256.value,
    zKnownJwaContentEncryptionAlgorithms.A192CBC_HS384.value,
    zKnownJwaContentEncryptionAlgorithms.A256CBC_HS512.value,
  ]),
  iv: z.instanceof(Uint8Array).refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC with HMAC'),
  aad: z.optional(z.instanceof(Uint8Array)),
  tag: z.instanceof(Uint8Array),
})
export type KmsDecryptDataDecryptionAesCbcHmac = z.output<typeof zKmsDecryptDataDecryptionAesCbcHmac>

// ChaCha20-Poly1305 Content Decryption
const zKmsDecryptDataDecryptionC20p = z.object({
  algorithm: z.enum([
    zKnownJwaContentEncryptionAlgorithms.C20P.value,
    zKnownJwaContentEncryptionAlgorithms.XC20P.value,
  ]),
  iv: z.instanceof(Uint8Array),
  aad: z.optional(z.instanceof(Uint8Array)),
  tag: z.instanceof(Uint8Array),
})
// FIXME: see how we can do refine with the discriminated union
// .refine(
//   ({ iv, algorithm }) => iv.length === (algorithm === 'C20P' ? 12 : 24),
//   `iv must be 12 bytes for C20P (ChaCha20-Poly1305) or 24 bytes for XC20P (XChaCha20-Poly1305)`
// )
export type KmsDecryptDataDecryptionC20p = z.output<typeof zKmsDecryptDataDecryptionC20p>

const zKmsDecryptDataDecryption = z.discriminatedUnion('algorithm', [
  zKmsDecryptDataDecryptionAesCbc,
  zKmsDecryptDataDecryptionAesCbcHmac,
  zKmsDecryptDataDecryptionAesGcm,
  zKmsDecryptDataDecryptionC20p,
])
export type KmsDecryptDataDecryption = z.output<typeof zKmsDecryptDataDecryption>

export const zKmsDecryptOptions = z.object({
  /**
   * The keyId to use for decrypting.
   */
  key: z.union([z.string(), zKmsJwkPrivateOct]),

  /**
   * The decryption algorithm used to decrypt the data/content.
   * In JWE this parameter is referred to as "enc".
   */
  decryption: zKmsDecryptDataDecryption.describe(
    'Options related to the decryption algorithm to use for decrypting the data'
  ),

  /**
   * The encrypted data to decrypt
   */
  encrypted: z.instanceof(Uint8Array).describe('The encrypted data to decrypt'),
})

export type KmsDecryptOptions = z.output<typeof zKmsDecryptOptions>

export interface KmsDecryptReturn {
  /**
   * The decrypted data
   */
  data: Uint8Array
}
