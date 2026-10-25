import { z } from 'zod'
import { zAnyUint8Array } from '../../../utils/zod'
import { asymmetricJwkKeyTypeMatches } from '../jwk/equals'
import { isJwaHpkeAlgorithm, KnownJwaContentEncryptionAlgorithms, KnownJwaKeyAgreementAlgorithms } from '../jwk/jwa'
import { zKmsJwkPrivateOct } from '../jwk/kty/oct/octJwk'
import { zKmsKeyId } from './common'
import { type KmsJwkPublicEcdh, zKmsKeyAgreementEncryptOptions } from './KmsKeyAgreementEncryptOptions'

export interface KmsEncryptAadContext {
  /**
   * Public half of the ephemeral key this call generated: only kty, crv, x (and y for EC).
   */
  ephemeralPublicJwk: KmsJwkPublicEcdh
}

/**
 * The callback form is called exactly once, synchronously, before content encryption, and is only allowed with ECDH key agreement.
 */
export type KmsEncryptAad = Uint8Array | ((context: KmsEncryptAadContext) => Uint8Array)

const zKmsEncryptAad = z.custom<KmsEncryptAad>(
  (aad) => aad instanceof Uint8Array || typeof aad === 'function',
  'aad must be a Uint8Array or a function'
)

const ecdhKeyAgreementAlgorithms: string[] = [
  KnownJwaKeyAgreementAlgorithms.ECDH_ES,
  KnownJwaKeyAgreementAlgorithms.ECDH_ES_A128KW,
  KnownJwaKeyAgreementAlgorithms.ECDH_ES_A192KW,
  KnownJwaKeyAgreementAlgorithms.ECDH_ES_A256KW,
  KnownJwaKeyAgreementAlgorithms.ECDH_1PU_A256KW,
]

const ecdhContentEncryptionAlgorithms: string[] = [
  KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
  KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
  KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
  KnownJwaContentEncryptionAlgorithms.A128GCM,
  KnownJwaContentEncryptionAlgorithms.A192GCM,
  KnownJwaContentEncryptionAlgorithms.A256GCM,
  KnownJwaContentEncryptionAlgorithms.C20P,
  KnownJwaContentEncryptionAlgorithms.XC20P,
]

// https://datatracker.ietf.org/doc/html/draft-madden-jose-ecdh-1pu-04#section-2.1
const ecdh1PuContentEncryptionAlgorithms: string[] = [
  KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
  KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
  KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
]

/**
 * The content encryption algorithms `encrypt` and `decrypt` allow with a key agreement algorithm, or `undefined` if it is not ECDH.
 */
export function ecdhContentEncryptionAlgorithmsFor(keyAgreementAlgorithm: string): string[] | undefined {
  if (keyAgreementAlgorithm === KnownJwaKeyAgreementAlgorithms.ECDH_1PU_A256KW)
    return ecdh1PuContentEncryptionAlgorithms
  return ecdhKeyAgreementAlgorithms.includes(keyAgreementAlgorithm) ? ecdhContentEncryptionAlgorithms : undefined
}

const zKmsEncryptDataEncryptionAesGcm = z.object({
  // AES-GCM Content Encryption
  algorithm: z.enum([
    KnownJwaContentEncryptionAlgorithms.A128GCM,
    KnownJwaContentEncryptionAlgorithms.A192GCM,
    KnownJwaContentEncryptionAlgorithms.A256GCM,
  ]),

  iv: z.optional(zAnyUint8Array.refine((iv) => iv.length === 12, 'iv must be 12 bytes for AES GCM')),
  aad: z.optional(zKmsEncryptAad),
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
  aad: z.optional(zKmsEncryptAad),
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
  aad: z.optional(zKmsEncryptAad),
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
     * - an object configuring key agreement with the recipient public key(s)
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

    const { keyAgreement } = value.key
    const { encryption } = value
    const ecdhEncryptionAlgorithms = keyAgreement && ecdhContentEncryptionAlgorithmsFor(keyAgreement.algorithm)
    const usesEcdh = ecdhEncryptionAlgorithms !== undefined

    if ('aad' in encryption && typeof encryption.aad === 'function' && !usesEcdh) {
      issues.push({
        code: 'custom',
        input: encryption.aad,
        path: ['encryption', 'aad'],
        message: `'encryption.aad' can only be a callback with ECDH key agreement`,
      })
    }

    if (ecdhEncryptionAlgorithms && !ecdhEncryptionAlgorithms.includes(encryption.algorithm)) {
      issues.push({
        code: 'custom',
        input: encryption,
        path: ['encryption', 'algorithm'],
        message: `'encryption.algorithm' must be one of ${ecdhEncryptionAlgorithms.join(', ')} for key agreement algorithm '${keyAgreement?.algorithm}'`,
      })
    }

    if (usesEcdh && 'iv' in encryption && encryption.iv) {
      issues.push({
        code: 'custom',
        input: encryption.iv,
        path: ['encryption', 'iv'],
        message: `'encryption.iv' cannot be provided with ECDH key agreement`,
      })
    }

    if (
      keyAgreement &&
      'recipients' in keyAgreement &&
      keyAgreement.recipients.some(
        ({ externalPublicJwk }) =>
          !asymmetricJwkKeyTypeMatches(keyAgreement.recipients[0].externalPublicJwk, externalPublicJwk)
      )
    ) {
      issues.push({
        code: 'custom',
        input: keyAgreement.recipients,
        path: ['key', 'keyAgreement', 'recipients'],
        message: 'All recipient keys must have the same key type and curve, as they share one ephemeral key',
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
   * The public ephemeral key, set for the ECDH-ES, ECDH-ES+KW and ECDH-1PU+KW key agreement algorithms
   */
  ephemeralPublicJwk?: KmsJwkPublicEcdh

  /**
   * The encrypted content encryption keys, in the order of `keyAgreement.recipients`
   */
  encryptedKeys?: KmsEncryptedKey[]

  /**
   * The raw serialized HPKE encapsulated key (`enc`), if an integrated-encryption HPKE algorithm
   * was used. Unlike `encryptedKeys` this is not an encrypted CEK but the sender's ephemeral public
   * key, and it is not encrypted.
   */
  encapsulatedKey?: Uint8Array
}

export const zKmsEncryptedKey = z.object({
  /**
   * The encrypted key
   */
  encrypted: zAnyUint8Array,
})

/**
 * An encrypted content encryption key (CEK).
 */
export type KmsEncryptedKey = z.infer<typeof zKmsEncryptedKey>
