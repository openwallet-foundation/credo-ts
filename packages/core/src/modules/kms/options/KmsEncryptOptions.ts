import type { KmsJwkPrivateOct } from '../jwk'

import * as v from '../../../utils/valibot'
import { vKnownJwaContentEncryptionAlgorithms, vKnownJwaKeyEncryptionAlgorithms } from '../jwk/jwa'
import { vKmsJwkPrivateOct } from '../jwk/kty/oct'

// Key Wrapping with AES
// NOTE: we might want to extract this to a separate
// wrapKey method that only supports key wrapping algorithms
// but for now it's also possible to just do it using encrypt?
const vKmsEncryptKeyWrappingAesKw = v.object({
  algorithm: v.union([
    vKnownJwaKeyEncryptionAlgorithms.A128KW,
    vKnownJwaKeyEncryptionAlgorithms.A192KW,
    vKnownJwaKeyEncryptionAlgorithms.A256KW,
  ]),
})
export type KmsEncryptKeyWrappingAesKw = v.InferOutput<typeof vKmsEncryptKeyWrappingAesKw>

const vKmsEncryptDataEncryptionAesGcm = v.object({
  // AES-GCM Content Encryption
  algorithm: v.union([
    vKnownJwaContentEncryptionAlgorithms.A128GCM,
    vKnownJwaContentEncryptionAlgorithms.A192GCM,
    vKnownJwaContentEncryptionAlgorithms.A256GCM,
  ]),

  iv: v.optional(
    v.pipe(
      v.instance(Uint8Array),
      v.check((iv) => iv.length === 12, `iv must be 12 bytes for AES GCM`)
    )
  ),
  aad: v.optional(v.instance(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesGcm = v.InferOutput<typeof vKmsEncryptDataEncryptionAesGcm>

// AES-CBC Content Encryption
const vKmsEncryptDataEncryptionAesCbc = v.object({
  algorithm: v.union([vKnownJwaContentEncryptionAlgorithms.A128CBC, vKnownJwaContentEncryptionAlgorithms.A256CBC]),
  iv: v.optional(
    v.pipe(
      v.instance(Uint8Array),
      v.check((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC`)
    )
  ),
})
export type KmsEncryptDataEncryptionAesCbc = v.InferOutput<typeof vKmsEncryptDataEncryptionAesCbc>

// AES-CBC with HMAC-SHA2 Content Encryption
const vKmsEncryptDataEncryptionAesCbcHmac = v.object({
  algorithm: v.union([
    vKnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
    vKnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
    vKnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
  ]),
  iv: v.optional(
    v.pipe(
      v.instance(Uint8Array),
      v.check((iv) => iv.length === 16, `iv must be 16 bytes for AES CBC with HMAC`)
    )
  ),
  aad: v.optional(v.instance(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesCbcHmac = v.InferOutput<typeof vKmsEncryptDataEncryptionAesCbcHmac>

// ChaCha20-Poly130 Content Encryption
const vKmsEncryptDataEncryptionC20p = v.pipe(
  v.object({
    algorithm: v.union([vKnownJwaContentEncryptionAlgorithms.C20P, vKnownJwaContentEncryptionAlgorithms.XC20P]),
    iv: v.optional(v.instance(Uint8Array)),
    aad: v.optional(v.instance(Uint8Array)),
  }),
  v.check(
    ({ iv, algorithm }) => !iv || iv.length === (algorithm === 'C20P' ? 12 : 24),
    `iv must be 12 bytes for C20P (ChaCha20-Poly1305) or 24 bytes for XC20P (XChaCha20-Poly1305)`
  )
)
export type KmsEncryptDataEncryptionX20c = v.InferOutput<typeof vKmsEncryptDataEncryptionC20p>

export const vKmsEncryptDataEncryption = v.variant('algorithm', [
  vKmsEncryptDataEncryptionAesCbc,
  vKmsEncryptDataEncryptionAesCbcHmac,
  vKmsEncryptDataEncryptionAesGcm,
  vKmsEncryptDataEncryptionC20p,
  vKmsEncryptKeyWrappingAesKw,
])
export type KmsEncryptDataEncryption = v.InferOutput<typeof vKmsEncryptDataEncryption>

export const vKmsEncryptOptions = v.object({
  key: v.union([v.string(), vKmsJwkPrivateOct]),

  encryption: v.pipe(
    vKmsEncryptDataEncryption,
    v.description('Options related to the encryption algorithm to use for encrypting the data')
  ),

  data: v.pipe(v.instance(Uint8Array), v.description('The data to encrypt')),
})

export interface KmsEncryptOptions {
  /**
   * The key to use for encrypting.
   *
   * Either a key id reference or a private oct (symmetric) key jwk
   */
  key: string | KmsJwkPrivateOct

  /**
   * The encryption algorithm used to encrypt the data/content.
   * In JWE this parameter is referred to as "enc".
   */
  encryption: KmsEncryptDataEncryption

  /**
   * The data to encrypt
   */
  data: Uint8Array
}

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
