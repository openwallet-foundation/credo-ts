import type { KmsJwkPrivateOct } from '../jwk/kty/oct'

import * as z from '../../../utils/zod'
import { vKnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { vKmsJwkPrivateOct } from '../jwk/kty/oct'

const vKmsDecryptDataDecryptionAesGcm = z.object({
  // AES-GCM Content Decryption
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.A128GCM.value,
    vKnownJwaContentEncryptionAlgorithms.A192GCM.value,
    vKnownJwaContentEncryptionAlgorithms.A256GCM.value,
  ]),

  iv: z.instanceof(Uint8Array).refine((iv) => iv.length === 12, `iv must be 12 bytes for AES GCM`),
  aad: z.optional(z.instanceof(Uint8Array)),
  tag: z.instanceof(Uint8Array),
})
export type KmsDecryptDataDecryptionAesGcm = z.output<typeof vKmsDecryptDataDecryptionAesGcm>

// AES-CBC Content Decryption
const vKmsDecryptDataDecryptionAesCbc = z.object({
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.A128CBC.value,
    vKnownJwaContentEncryptionAlgorithms.A256CBC.value,
  ]),
  iv: z.instanceof(Uint8Array).refine((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC`),
})
export type KmsDecryptDataDecryptionAesCbc = z.output<typeof vKmsDecryptDataDecryptionAesCbc>

// AES-CBC Content Decryption
const vKmsDecryptDataDecryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.A128CBC_HS256.value,
    vKnownJwaContentEncryptionAlgorithms.A192CBC_HS384.value,
    vKnownJwaContentEncryptionAlgorithms.A256CBC_HS512.value,
  ]),
  iv: z.instanceof(Uint8Array).refine((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC with HMAC`),
  aad: z.optional(z.instanceof(Uint8Array)),
  tag: z.instanceof(Uint8Array),
})
export type KmsDecryptDataDecryptionAesCbcHmac = z.output<typeof vKmsDecryptDataDecryptionAesCbcHmac>

// ChaCha20-Poly1305 Content Decryption
const vKmsDecryptDataDecryptionC20p = z.object({
  algorithm: z.enum([
    vKnownJwaContentEncryptionAlgorithms.C20P.value,
    vKnownJwaContentEncryptionAlgorithms.XC20P.value,
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
export type KmsDecryptDataDecryptionC20p = z.output<typeof vKmsDecryptDataDecryptionC20p>

const vKmsDecryptDataDecryption = z.discriminatedUnion('algorithm', [
  vKmsDecryptDataDecryptionAesCbc,
  vKmsDecryptDataDecryptionAesCbcHmac,
  vKmsDecryptDataDecryptionAesGcm,
  vKmsDecryptDataDecryptionC20p,
])
export type KmsDecryptDataDecryption = z.output<typeof vKmsDecryptDataDecryption>

export const vKmsDecryptOptions = z.object({
  /**
   * The keyId to use for decrypting.
   */
  key: z.union([z.string(), vKmsJwkPrivateOct]),

  /**
   * The decryption algorithm used to decrypt the data/content.
   * In JWE this parameter is referred to as "enc".
   */
  decryption: vKmsDecryptDataDecryption.describe(
    'Options related to the decryption algorithm to use for decrypting the data'
  ),

  /**
   * The encrypted data to decrypt
   */
  encrypted: z.instanceof(Uint8Array).describe('The encrypted data to decrypt'),
})

export type KmsDecryptOptions = z.output<typeof vKmsDecryptOptions>

export interface KmsDecryptReturn {
  /**
   * The decrypted data
   */
  data: Uint8Array
}
