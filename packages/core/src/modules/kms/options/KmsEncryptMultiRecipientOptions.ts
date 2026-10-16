import { z } from 'zod'
import { zAnyUint8Array } from '../../../utils/zod'
import { KnownJwaContentEncryptionAlgorithms } from '../jwk/jwa'
import { zKmsKeyId } from './common'
import type { KmsEncryptedKey } from './KmsEncryptOptions'
import { type KmsJwkPublicEcdh, zKmsJwkPublicEcdh } from './KmsKeyAgreementEncryptOptions'

const zKmsMultiRecipients = z.array(z.object({ externalPublicJwk: zKmsJwkPublicEcdh })).min(1)

const zKmsKeyAgreementEncryptMultiRecipientEcdhEsKw = z.object({
  algorithm: z.enum(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW']),
  recipients: zKmsMultiRecipients,
  apu: z.optional(zAnyUint8Array),
  apv: z.optional(zAnyUint8Array),
})

const zKmsKeyAgreementEncryptMultiRecipientEcdh1Pu = z.object({
  /**
   * The key id of the sender's static key.
   */
  keyId: zKmsKeyId,
  algorithm: z.literal('ECDH-1PU+A256KW'),
  recipients: zKmsMultiRecipients,
  apu: z.optional(zAnyUint8Array),
  apv: z.optional(zAnyUint8Array),
})

export const zKmsKeyAgreementEncryptMultiRecipientOptions = z.discriminatedUnion('algorithm', [
  zKmsKeyAgreementEncryptMultiRecipientEcdhEsKw,
  zKmsKeyAgreementEncryptMultiRecipientEcdh1Pu,
])
export type KmsKeyAgreementEncryptMultiRecipientOptions = z.output<typeof zKmsKeyAgreementEncryptMultiRecipientOptions>

const ecdh1PuContentEncryptionAlgorithms: string[] = [
  KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
  KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
  KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
]

export const zKmsEncryptMultiRecipientOptions = z
  .object({
    keyAgreement: zKmsKeyAgreementEncryptMultiRecipientOptions,
    encryption: z.object({
      algorithm: z.enum([
        KnownJwaContentEncryptionAlgorithms.A128CBC_HS256,
        KnownJwaContentEncryptionAlgorithms.A192CBC_HS384,
        KnownJwaContentEncryptionAlgorithms.A256CBC_HS512,
        KnownJwaContentEncryptionAlgorithms.A128GCM,
        KnownJwaContentEncryptionAlgorithms.A192GCM,
        KnownJwaContentEncryptionAlgorithms.A256GCM,
        KnownJwaContentEncryptionAlgorithms.C20P,
        KnownJwaContentEncryptionAlgorithms.XC20P,
      ]),
    }),

    /**
     * Builds the aad from the generated ephemeral public key, since a JWE protected header contains the `epk`.
     */
    aad: z.optional(
      z.custom<(ephemeralPublicJwk: KmsJwkPublicEcdh) => Uint8Array>(
        (aad) => typeof aad === 'function',
        'aad must be a function'
      )
    ),
    data: zAnyUint8Array,
  })
  .check(({ value, issues }) => {
    const [first, ...others] = value.keyAgreement.recipients
    // An empty list still reaches this check, as the min(1) issue does not abort parsing
    if (
      first &&
      others.some(
        ({ externalPublicJwk }) =>
          externalPublicJwk.kty !== first.externalPublicJwk.kty || externalPublicJwk.crv !== first.externalPublicJwk.crv
      )
    ) {
      issues.push({
        code: 'custom',
        input: value.keyAgreement.recipients,
        path: ['keyAgreement', 'recipients'],
        message: 'All recipient keys must have the same key type and curve, as they share one ephemeral key',
      })
    }

    if (
      value.keyAgreement.algorithm === 'ECDH-1PU+A256KW' &&
      !ecdh1PuContentEncryptionAlgorithms.includes(value.encryption.algorithm)
    ) {
      issues.push({
        code: 'custom',
        input: value.encryption,
        path: ['encryption', 'algorithm'],
        message: `'encryption.algorithm' must be one of ${ecdh1PuContentEncryptionAlgorithms.join(', ')} for key agreement algorithm 'ECDH-1PU+A256KW'`,
      })
    }
  })
export type KmsEncryptMultiRecipientOptions = z.output<typeof zKmsEncryptMultiRecipientOptions>

export interface KmsEncryptMultiRecipientReturn {
  encrypted: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  ephemeralPublicJwk: KmsJwkPublicEcdh

  /**
   * In the order of `keyAgreement.recipients`.
   */
  encryptedKeys: KmsEncryptedKey[]
}
