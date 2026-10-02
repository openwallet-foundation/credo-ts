import { z } from 'zod'
import { zAnyUint8Array } from '../../../utils/zod'
import { isJwaHpkeAlgorithm, KnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct/octJwk'
import { zKmsKeyId } from './common'
import { zKmsKeyAgreementDecryptOptions } from './KmsKeyAgreementDecryptOptions'

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

/**
 * Integrated-encryption HPKE. The HPKE suite (see the `HPKE-*` key agreement algorithms) fixes the
 * AEAD, and both the content encryption key and the nonce are derived from the HPKE key schedule.
 * The tag is part of the HPKE ciphertext, so the only parameter left to the caller is the aad.
 */
const zKmsDecryptDataDecryptionHpke = z.object({
  algorithm: z.literal('HPKE'),
  aad: z.optional(zAnyUint8Array),
})
export type KmsDecryptDataDecryptionHpke = z.output<typeof zKmsDecryptDataDecryptionHpke>

const zKmsDecryptDataDecryption = z.discriminatedUnion('algorithm', [
  zKmsDecryptDataDecryptionAesCbc,
  zKmsDecryptDataDecryptionAesCbcHmac,
  zKmsDecryptDataDecryptionAesGcm,
  zKmsDecryptDataDecryptionC20p,
  zKmsDecryptDataDecryptionSalsa,
  zKmsDecryptDataDecryptionHpke,
])
export type KmsDecryptDataDecryption = z.output<typeof zKmsDecryptDataDecryption>

/**
 * Content decryption excluding the integrated-encryption HPKE marker, so the AEAD parameters a
 * backend performs the actual content decryption with.
 */
export type KmsDecryptDataContentDecryption = Exclude<KmsDecryptDataDecryption, { algorithm: 'HPKE' }>

export const zKmsDecryptOptions = z
  .object({
    /**
     * The key to use for decrypting. There are three possible formats:
     * - a key id, pointing to a symmetric (oct) jwk that can be used directly for decryption
     * - a private symmetric (oct) jwk object that can be used directly for decryption
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
        keyAgreement: zKmsKeyAgreementDecryptOptions,

        // never helps with type narrowing
        keyId: z.never().optional(),
        privateJwk: z.never().optional(),
      }),
    ]),

    /**
     * The decryption algorithm used to decrypt the data/content.
     * In JWE this parameter is referred to as "enc".
     *
     * Must be 'HPKE' for the integrated-encryption HPKE algorithms, where the suite fixes the AEAD
     * and only the aad is left to the caller.
     */
    decryption: zKmsDecryptDataDecryption.describe(
      'Options related to the decryption algorithm to use for decrypting the data'
    ),

    /**
     * The encrypted data to decrypt
     */
    encrypted: zAnyUint8Array.describe('The encrypted data to decrypt'),
  })
  .check(({ value, issues }) => {
    const usesIntegratedEncryption = value.key.keyAgreement && isJwaHpkeAlgorithm(value.key.keyAgreement.algorithm)
    const usesHpkeContentDecryption = value.decryption.algorithm === 'HPKE'

    if (usesIntegratedEncryption && !usesHpkeContentDecryption) {
      issues.push({
        code: 'custom',
        input: value.decryption,
        path: ['decryption', 'algorithm'],
        message: `'decryption.algorithm' must be 'HPKE' for key agreement algorithm '${value.key.keyAgreement?.algorithm}', as the HPKE suite defines the content encryption algorithm`,
      })
    } else if (!usesIntegratedEncryption && usesHpkeContentDecryption) {
      issues.push({
        code: 'custom',
        input: value.decryption,
        path: ['decryption', 'algorithm'],
        message: `'decryption.algorithm' 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`,
      })
    }
  })

export type KmsDecryptOptions = z.output<typeof zKmsDecryptOptions>

export interface KmsDecryptReturn {
  /**
   * The decrypted data
   */
  data: Uint8Array
}
