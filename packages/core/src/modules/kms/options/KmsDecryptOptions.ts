import { z } from 'zod'
import type { Uint8ArrayBuffer } from '../../../types'
import { zAnyUint8Array } from '../../../utils/zod'
import { KnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct/octJwk'
import { zKmsKeyAgreementDecryptOptions } from './KmsKeyAgreementDecryptOptions'
import { zKmsKeyId } from './common'

const zKmsDecryptDataDecryptionAesGcm = z.object({
  // AES-GCM Content Decryption
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128GCM,
    KnownJwaContentEncryptionAlgorithms.A192GCM,
    KnownJwaContentEncryptionAlgorithms.A256GCM,
  ]),

  iv: zAnyUint8Array.refine((iv) => iv.length === 12, 'iv must be 12 bytes for AES GCM'),
  aad: z.optional(zAnyUint8Array),
  tag: zAnyUint8Array,
})
export type KmsDecryptDataDecryptionAesGcm = z.output<typeof zKmsDecryptDataDecryptionAesGcm>

// AES-CBC Content Decryption
const zKmsDecryptDataDecryptionAesCbc = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms.A128CBC, KnownJwaContentEncryptionAlgorithms.A256CBC]),
  iv: zAnyUint8Array.refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC'),
})
export type KmsDecryptDataDecryptionAesCbc = z.output<typeof zKmsDecryptDataDecryptionAesCbc>

// AES-CBC Content Decryption
const zKmsDecryptDataDecryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
    KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
    KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
  ]),
  iv: zAnyUint8Array.refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC with HMAC'),
  aad: z.optional(zAnyUint8Array),
  tag: zAnyUint8Array,
})
export type KmsDecryptDataDecryptionAesCbcHmac = z.output<typeof zKmsDecryptDataDecryptionAesCbcHmac>

// XSalsa20-Poly1305 Content Decryption
const zKmsDecryptDataDecryptionSalsa = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms['XSALSA20-POLY1305']]),
  iv: zAnyUint8Array.optional(),
})

// ChaCha20-Poly1305 Content Decryption
const zKmsDecryptDataDecryptionC20p = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms.C20P, KnownJwaContentEncryptionAlgorithms.XC20P]),
  iv: zAnyUint8Array,
  aad: z.optional(zAnyUint8Array),
  tag: zAnyUint8Array,
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
  zKmsDecryptDataDecryptionSalsa,
])
export type KmsDecryptDataDecryption = z.output<typeof zKmsDecryptDataDecryption>

export const zKmsDecryptOptions = z.object({
  /**
   * The key to use for decrypting. There are three possible formats:
   * - a key id, pointing to a symmetric (oct) jwk that can be used directly for decryption
   * - a private symmetric (oct) jwk object that can be used directly for decryption
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
      keyAgreement: zKmsKeyAgreementDecryptOptions,

      // never helps with type narrowing
      keyId: z.never().optional(),
      privateJwk: z.never().optional(),
    }),
  ]),

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
  encrypted: zAnyUint8Array.describe('The encrypted data to decrypt'),
})

export type KmsDecryptOptions = z.output<typeof zKmsDecryptOptions>

export interface KmsDecryptReturn {
  /**
   * The decrypted data
   */
  data: Uint8ArrayBuffer
}
