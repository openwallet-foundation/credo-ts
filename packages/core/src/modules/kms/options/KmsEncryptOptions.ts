import { z } from 'zod'
import { zAnyUint8Array } from '../../../utils/zod'
import { isJwaHpkeAlgorithm, KnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct/octJwk'
import { zKmsKeyId } from './common'
import { zKmsKeyAgreementEncryptOptions } from './KmsKeyAgreementEncryptOptions'

const zKmsEncryptDataEncryptionAesGcm = z.object({
  // AES-GCM Content Encryption
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128GCM,
    KnownJwaContentEncryptionAlgorithms.A192GCM,
    KnownJwaContentEncryptionAlgorithms.A256GCM,
  ]),

  iv: z.optional(zAnyUint8Array.refine((iv) => iv.length === 12, 'iv must be 12 bytes for AES GCM')),
  aad: z.optional(zAnyUint8Array),
})
export type KmsEncryptDataEncryptionAesGcm = z.output<typeof zKmsEncryptDataEncryptionAesGcm>

// AES-CBC Content Encryption
const zKmsEncryptDataEncryptionAesCbc = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms.A128CBC, KnownJwaContentEncryptionAlgorithms.A256CBC]),
  iv: z.optional(zAnyUint8Array.refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC')),
})
export type KmsEncryptDataEncryptionAesCbc = z.output<typeof zKmsEncryptDataEncryptionAesCbc>

// AES-CBC with HMAC-SHA2 Content Encryption
const zKmsEncryptDataEncryptionAesCbcHmac = z.object({
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
    KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
    KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
  ]),
  iv: z.optional(zAnyUint8Array.refine((iv) => iv.length === 16, 'iv must be 16 bytes for AES CBC with HMAC')),
  aad: z.optional(zAnyUint8Array),
})
export type KmsEncryptDataEncryptionAesCbcHmac = z.output<typeof zKmsEncryptDataEncryptionAesCbcHmac>

// XSalsa-Poly1305 Content Encryption
const zKmsDecryptDataEncryptionSalsa = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms['XSALSA20-POLY1305']]),
  iv: zAnyUint8Array.optional(),
})

// ChaCha20-Poly130 Content Encryption
const zKmsEncryptDataEncryptionC20p = z.object({
  algorithm: z.enum([KnownJwaContentEncryptionAlgorithms.C20P, KnownJwaContentEncryptionAlgorithms.XC20P]),
  iv: z.optional(zAnyUint8Array),
  aad: z.optional(zAnyUint8Array),
})
// FIXME: if we use refine, we can't use discriminated union. and that makes the error handlnig shitty
// .refine(
//   ({ iv, algorithm }) => !iv || iv.length === (algorithm === 'C20P' ? 12 : 24),
//   `iv must be 12 bytes for C20P (ChaCha20-Poly1305) or 24 bytes for XC20P (XChaCha20-Poly1305)`
// )

export type KmsEncryptDataEncryptionX20c = z.output<typeof zKmsEncryptDataEncryptionC20p>

/**
 * Integrated-encryption HPKE. The HPKE suite (see the `HPKE-*` key agreement algorithms) fixes the
 * AEAD, and both the content encryption key and the nonce are derived from the HPKE key schedule.
 * The only content encryption parameter left to the caller is the aad.
 */
const zKmsEncryptDataEncryptionHpke = z.object({
  algorithm: z.literal('HPKE'),
  aad: z.optional(zAnyUint8Array),
})
export type KmsEncryptDataEncryptionHpke = z.output<typeof zKmsEncryptDataEncryptionHpke>

export const zKmsEncryptDataEncryption = z.discriminatedUnion('algorithm', [
  zKmsEncryptDataEncryptionAesCbc,
  zKmsEncryptDataEncryptionAesCbcHmac,
  zKmsEncryptDataEncryptionAesGcm,
  zKmsEncryptDataEncryptionC20p,
  zKmsDecryptDataEncryptionSalsa,
  zKmsEncryptDataEncryptionHpke,
])
export type KmsEncryptDataEncryption = z.output<typeof zKmsEncryptDataEncryption>

/**
 * Content encryption excluding the integrated-encryption HPKE marker, so the AEAD parameters a
 * backend performs the actual content encryption with.
 */
export type KmsEncryptDataContentEncryption = Exclude<KmsEncryptDataEncryption, { algorithm: 'HPKE' }>

export const zKmsEncryptOptions = z
  .object({
    /**
     * The key to use for encrypting. There are three possible formats:
     * - a key id, pointing to a symmetric (oct) jwk that can be used directly for encryption
     * - a private symmetric (oct) jwk object that can be used directly for encryption
     * - an object configuring key agreement, based on an existing asymmetric key
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
     *
     * Must be 'HPKE' for the integrated-encryption HPKE algorithms, where the suite fixes the AEAD
     * and only the aad is left to the caller.
     */
    encryption: zKmsEncryptDataEncryption.describe(
      'Options related to the encryption algorithm to use for encrypting the data'
    ),

    /**
     * The data to encrypt
     */
    data: zAnyUint8Array.describe('The data to encrypt'),
  })
  .check(({ value, issues }) => {
    const usesIntegratedEncryption = value.key.keyAgreement && isJwaHpkeAlgorithm(value.key.keyAgreement.algorithm)
    const usesHpkeContentEncryption = value.encryption.algorithm === 'HPKE'

    if (usesIntegratedEncryption && !usesHpkeContentEncryption) {
      issues.push({
        code: 'custom',
        input: value.encryption,
        path: ['encryption', 'algorithm'],
        message: `'encryption.algorithm' must be 'HPKE' for key agreement algorithm '${value.key.keyAgreement?.algorithm}', as the HPKE suite defines the content encryption algorithm`,
      })
    } else if (!usesIntegratedEncryption && usesHpkeContentEncryption) {
      issues.push({
        code: 'custom',
        input: value.encryption,
        path: ['encryption', 'algorithm'],
        message: `'encryption.algorithm' 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`,
      })
    }
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
  iv?: Uint8Array // may be any uint8array since the user can also provide it as input

  /**
   * The encrypted content encryption key, if key wrapping was used
   */
  encryptedKey?: KmsEncryptedKey

  /**
   * The raw serialized HPKE encapsulated key (`enc`), if an integrated-encryption HPKE algorithm
   * was used. Unlike `encryptedKey` this is not an encrypted CEK but the sender's ephemeral public
   * key, and it is not encrypted.
   */
  encapsulatedKey?: Uint8Array
}

export const zKmsEncryptedKey = z.object({
  /**
   * Optional authentication tag
   */
  tag: zAnyUint8Array.optional(),

  /**
   * The initialization vector.
   */
  iv: zAnyUint8Array.optional(),

  /**
   * The encrypted key
   */
  encrypted: zAnyUint8Array,
})

/**
 * An encrypted content encryption key (CEK).
 */
export type KmsEncryptedKey = z.infer<typeof zKmsEncryptedKey>
