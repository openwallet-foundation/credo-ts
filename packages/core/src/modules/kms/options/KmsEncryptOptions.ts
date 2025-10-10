import { z } from 'zod'
import { KnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct/octJwk'
import { zKmsKeyAgreementEncryptOptions } from './KmsKeyAgreementEncryptOptions'
import { zKmsKeyId } from './common'

const zKmsEncryptDataEncryptionAesGcm = z.object({
  // AES-GCM Content Encryption
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128GCM,
    KnownJwaContentEncryptionAlgorithms.A192GCM,
    KnownJwaContentEncryptionAlgorithms.A256GCM,
  ]),

  iv: z.optional(z.instanceof(Uint8Array).refine((iv) => iv.length === 12, 'iv must be 12 bytes for AES GCM')),
  aad: z.optional(z.instanceof(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesGcm = z.output<typeof zKmsEncryptDataEncryptionAesGcm>

// AES-CBC Content Encryption
const zKmsEncryptDataEncryptionAesCbc = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms.A128CBC, KnownJwaContentEncryptionAlgorithms.A256CBC]),
  iv: z.optional(z.instanceof(Uint8Array).refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC')),
})
export type KmsEncryptDataEncryptionAesCbc = z.output<typeof zKmsEncryptDataEncryptionAesCbc>

// AES-CBC with HMAC-SHA2 Content Encryption
const zKmsEncryptDataEncryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
    KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
    KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
  ]),
  iv: z.optional(
    z.instanceof(Uint8Array).refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC with HMAC')
  ),
  aad: z.optional(z.instanceof(Uint8Array)),
})
export type KmsEncryptDataEncryptionAesCbcHmac = z.output<typeof zKmsEncryptDataEncryptionAesCbcHmac>

// XSalsa-Poly1305 Content Encryption
const zKmsDecryptDataEncryptionSalsa = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms['XSALSA20-POLY1305']]),
  iv: z.instanceof(Uint8Array).optional(),
})

// ChaCha20-Poly130 Content Encryption
const zKmsEncryptDataEncryptionC20p = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms.C20P, KnownJwaContentEncryptionAlgorithms.XC20P]),
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
  zKmsDecryptDataEncryptionSalsa,
])
export type KmsEncryptDataEncryption = z.output<typeof zKmsEncryptDataEncryption>

export const zKmsEncryptOptions = z.object({
  /**
   * The key to use for encrypting. There are three possible formats:
   * - a key id, pointing to a symmetric (oct) jwk that can be used directly for encryption
   * - a private symmetric (oct) jwk object that can be used directly for encryption
   * - an object configuring key agreement, based on an existing assymetric key
   */
  key: z.union([
    z.object({
      keyId: zKmsKeyId,

      // never helps with type narrowing
      privateJwk: z.never().optional(),
      keyAgreement: z.never().optional(),
    }),
    z.object({
      privateJwk: zKmsJwkPrivateOct.describe('A private oct (symmetric) jwk'),

      // never helps with type narrowing
      keyId: z.never().optional(),
      keyAgreement: z.never().optional(),
    }),
    z.object({
      keyAgreement: zKmsKeyAgreementEncryptOptions,

      // never helps with type narrowing
      keyId: z.never().optional(),
      privateJwk: z.never().optional(),
    }),
  ]),

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

  /**
   * The encrypted content encryption key, if key wrapping was used
   */
  encryptedKey?: KmsEncryptedKey
}

export const zKmsEncryptedKey = z.object({
  /**
   * Optional authentication tag
   */
  tag: z.instanceof(Uint8Array).optional(),

  /**
   * The initialization vector.
   */
  iv: z.instanceof(Uint8Array).optional(),

  /**
   * The encrypted key
   */
  encrypted: z.instanceof(Uint8Array),
})

/**
 * An encrypted content encryption key (CEK).
 */
export type KmsEncryptedKey = z.infer<typeof zKmsEncryptedKey>
