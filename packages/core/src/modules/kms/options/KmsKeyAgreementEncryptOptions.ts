import { z } from 'zod'
import { zAnyUint8Array } from '../../../utils/zod'
import { isJwaHpkeAlgorithm, zKnownJwaHpkeAlgorithm } from '../jwk/jwa'
import { zKmsJwkPublicEc } from '../jwk/kty/ec/ecJwk'
import { zKmsJwkPublicOkp } from '../jwk/kty/okp/okpJwk'
import { zKmsKeyId } from './common'

export const zKmsJwkPublicEcdh = z.union([
  zKmsJwkPublicOkp.extend({ crv: zKmsJwkPublicOkp.shape.crv.extract(['X25519']) }),
  zKmsJwkPublicEc.extend({ crv: zKmsJwkPublicEc.shape.crv.extract(['P-256', 'P-384', 'P-521', 'secp256k1']) }),
])

export type KmsJwkPublicEcdh = z.infer<typeof zKmsJwkPublicEcdh>

// Strict so a leftover ephemeral keyId fails instead of being dropped
const zKmsKeyAgreementEncryptEcdhEs = z.strictObject({
  algorithm: z.literal('ECDH-ES'),

  externalPublicJwk: zKmsJwkPublicEcdh,

  apu: z.optional(zAnyUint8Array),
  apv: z.optional(zAnyUint8Array),
})
export type KmsKeyAgreementEncryptEcdhEs = z.output<typeof zKmsKeyAgreementEncryptEcdhEs>

const zKmsEncryptRecipients = z.array(z.object({ externalPublicJwk: zKmsJwkPublicEcdh })).min(1)

const zKmsKeyAgreementEncryptEcdhEsKw = z.strictObject({
  algorithm: z.enum(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW']),
  recipients: zKmsEncryptRecipients,
  apu: z.optional(zAnyUint8Array),
  apv: z.optional(zAnyUint8Array),
})
export type KmsKeyAgreementEncryptEcdhEsKw = z.output<typeof zKmsKeyAgreementEncryptEcdhEsKw>

const zKmsKeyAgreementEncryptEcdh1Pu = z.object({
  /**
   * The key id of the sender's static key.
   */
  keyId: zKmsKeyId,
  algorithm: z.literal('ECDH-1PU+A256KW'),
  recipients: zKmsEncryptRecipients,
  apu: z.optional(zAnyUint8Array),
  apv: z.optional(zAnyUint8Array),
})
export type KmsKeyAgreementEncryptEcdh1Pu = z.output<typeof zKmsKeyAgreementEncryptEcdh1Pu>

const zKmsKeyAgreementEncryptEcdhHsalsa20 = z.object({
  /**
   * The key id of the sender's static key. Omit for anonymous encryption.
   */
  keyId: zKmsKeyId.optional(),

  /**
   * Perform key agreement based on the HSALSA20 as used in Libsodium's
   * Cryptobox. This is not based on an official JWA algorithm, but is
   * used primarily for DIDComm v1 messaging.
   */
  algorithm: z.literal('ECDH-HSALSA20'),

  externalPublicJwk: zKmsJwkPublicOkp.extend({ crv: zKmsJwkPublicOkp.shape.crv.extract(['X25519']) }),
})
export type KmsKeyAgreementEncryptEcdhHsalsa20 = z.output<typeof zKmsKeyAgreementEncryptEcdhHsalsa20>

export const zKmsKeyAgreementEncryptHpke = z.object({
  /**
   * HPKE (RFC 9180) in single-shot base mode. The suite fixes the AEAD, so `encryption` must not be
   * provided on the top-level encrypt options.
   */
  algorithm: zKnownJwaHpkeAlgorithm,

  /**
   * The public key of the recipient (`pkR`). HPKE generates its own ephemeral sender key, so no
   * `keyId` is used for sealing.
   */
  externalPublicJwk: zKmsJwkPublicEcdh,

  /**
   * Application supplied information, bound into the HPKE key schedule.
   */
  info: z.optional(zAnyUint8Array),
})
export type KmsKeyAgreementEncryptHpke = z.output<typeof zKmsKeyAgreementEncryptHpke>

export const zKmsKeyAgreementEncryptOptions = z
  .discriminatedUnion('algorithm', [
    zKmsKeyAgreementEncryptEcdhEs,
    zKmsKeyAgreementEncryptEcdhEsKw,
    zKmsKeyAgreementEncryptEcdh1Pu,
    zKmsKeyAgreementEncryptEcdhHsalsa20,
    zKmsKeyAgreementEncryptHpke,
  ])
  .describe('Options for key agreement based on an asymmetric key.')
export type KmsKeyAgreementEncryptOptions = z.output<typeof zKmsKeyAgreementEncryptOptions>

export function isKmsKeyAgreementEncryptHpke(
  keyAgreement: KmsKeyAgreementEncryptOptions
): keyAgreement is KmsKeyAgreementEncryptHpke {
  return isJwaHpkeAlgorithm(keyAgreement.algorithm)
}
