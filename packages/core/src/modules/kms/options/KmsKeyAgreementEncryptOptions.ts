import * as z from '../../../utils/zod'
import { zKmsJwkPublicEc } from '../jwk/kty/ec/ecJwk'
import { zKmsJwkPublicOkp } from '../jwk/kty/okp/okpJwk'
import { zKmsKeyId } from './common'

export const zKmsJwkPublicEcdh = z.union([
  zKmsJwkPublicOkp.extend({ crv: zKmsJwkPublicOkp.shape.crv.extract(['X25519']) }),
  zKmsJwkPublicEc.extend({ crv: zKmsJwkPublicEc.shape.crv.extract(['P-256', 'P-384', 'P-521', 'secp256k1']) }),
])

export type KmsJwkPublicEcdh = z.infer<typeof zKmsJwkPublicEcdh>

export const zKmsKeyAgreementEcdhEs = z.object({
  /**
   * The key id pointing to the ephemeral public key.
   *
   * The key type MUST match with the externalPublicJwk
   */
  keyId: zKmsKeyId,

  algorithm: z.literal('ECDH-ES'),

  externalPublicJwk: zKmsJwkPublicEcdh,

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsKeyAgreementEcdhEs = z.output<typeof zKmsKeyAgreementEcdhEs>

const zKmsKeyAgreementEncryptEcdhEsKw = z.object({
  /**
   * The key id pointing to the ephemeral public key.
   *
   * The key type MUST match with the externalPublicJwk
   */
  keyId: zKmsKeyId,

  algorithm: z.enum(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW']),

  externalPublicJwk: zKmsJwkPublicEcdh,

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsKeyAgreementEncryptEcdhEsKw = z.output<typeof zKmsKeyAgreementEncryptEcdhEsKw>

const zKmsKeyAgreementEncryptEcdhHsalsa20 = z.object({
  /**
   * The key id to use for encrypting the content encryption key.
   * If no key id is provided, anonymous encryption is used.
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

export const zKmsKeyAgreementEncryptOptions = z
  .discriminatedUnion('algorithm', [
    zKmsKeyAgreementEcdhEs,
    zKmsKeyAgreementEncryptEcdhEsKw,
    zKmsKeyAgreementEncryptEcdhHsalsa20,
  ])
  .describe('Options for key agreement based on an assymetric key.')
export type KmsKeyAgreementEncryptOptions = z.output<typeof zKmsKeyAgreementEncryptOptions>
