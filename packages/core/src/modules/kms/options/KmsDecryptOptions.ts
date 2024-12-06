import type { KmsJwkPrivateOct } from '../jwk/kty/oct'

import * as v from '../../../utils/valibot'
import { vKnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { vKmsJwkPrivateOct } from '../jwk/kty/oct'

const vKmsDecryptDataDecryptionAesGcm = v.object({
  // AES-GCM Content Decryption
  algorithm: v.union([
    vKnownJwaContentEncryptionAlgorithms.A128GCM,
    vKnownJwaContentEncryptionAlgorithms.A192GCM,
    vKnownJwaContentEncryptionAlgorithms.A256GCM,
  ]),

  iv: v.pipe(
    v.instance(Uint8Array),
    v.check((iv) => iv.length === 12, `iv must be 12 bytes for AES GCM`)
  ),
  aad: v.optional(v.instance(Uint8Array)),
  tag: v.instance(Uint8Array),
})
export type KmsDecryptDataDecryptionAesGcm = v.InferOutput<typeof vKmsDecryptDataDecryptionAesGcm>

// AES-CBC Content Decryption
const vKmsDecryptDataDecryptionAesCbc = v.object({
  algorithm: v.union([vKnownJwaContentEncryptionAlgorithms.A128CBC, vKnownJwaContentEncryptionAlgorithms.A256CBC]),
  iv: v.pipe(
    v.instance(Uint8Array),
    v.check((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC`)
  ),
})
export type KmsDecryptDataDecryptionAesCbc = v.InferOutput<typeof vKmsDecryptDataDecryptionAesCbc>

// AES-CBC Content Decryption
const vKmsDecryptDataDecryptionAesCbcHmac = v.object({
  algorithm: v.union([
    vKnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
    vKnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
    vKnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
  ]),
  iv: v.pipe(
    v.instance(Uint8Array),
    v.check((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC with HMAC`)
  ),
  aad: v.optional(v.instance(Uint8Array)),
  tag: v.instance(Uint8Array),
})
export type KmsDecryptDataDecryptionAesCbcHmac = v.InferOutput<typeof vKmsDecryptDataDecryptionAesCbcHmac>

// ChaCha20-Poly1305 Content Decryption
const vKmsDecryptDataDecryptionC20p = v.pipe(
  v.object({
    algorithm: v.union([vKnownJwaContentEncryptionAlgorithms.C20P, vKnownJwaContentEncryptionAlgorithms.XC20P]),
    iv: v.instance(Uint8Array),
    aad: v.optional(v.instance(Uint8Array)),
    tag: v.instance(Uint8Array),
  }),
  v.check(
    ({ iv, algorithm }) => iv.length === (algorithm === 'C20P' ? 12 : 24),
    `iv must be 12 bytes for C20P (ChaCha20-Poly1305) or 24 bytes for XC20P (XChaCha20-Poly1305)`
  )
)
export type KmsDecryptDataDecryptionC20p = v.InferOutput<typeof vKmsDecryptDataDecryptionC20p>

const vKmsDecryptDataDecryption = v.variant('algorithm', [
  vKmsDecryptDataDecryptionAesCbc,
  vKmsDecryptDataDecryptionAesCbcHmac,
  vKmsDecryptDataDecryptionAesGcm,
  vKmsDecryptDataDecryptionC20p,
])
export type KmsDecryptDataDecryption = v.InferOutput<typeof vKmsDecryptDataDecryption>

export const vKmsDecryptOptions = v.object({
  key: v.union([v.string(), vKmsJwkPrivateOct]),

  decryption: v.pipe(
    vKmsDecryptDataDecryption,
    v.description('Options related to the decryption algorithm to use for decrypting the data')
  ),

  encrypted: v.pipe(v.instance(Uint8Array), v.description('The encrypted data to decrypt')),
})

export interface KmsDecryptOptions {
  /**
   * The keyId to use for decrypting.
   */
  key: string | KmsJwkPrivateOct

  /**
   * The decryption algorithm used to decrypt the data/content.
   * In JWE this parameter is referred to as "enc".
   */
  decryption: KmsDecryptDataDecryption

  /**
   * The encrypted data to decrypt
   */
  encrypted: Uint8Array
}

export interface KmsDecryptReturn {
  /**
   * The decrypted data
   */
  data: Uint8Array
}
