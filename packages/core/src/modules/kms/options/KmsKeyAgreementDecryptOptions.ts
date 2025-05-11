import * as z from '../../../utils/zod'
import { zKmsJwkPublicOkp } from '../jwk/kty/okp/okpJwk'
import { zKmsEncryptedKey } from './KmsEncryptOptions'
import { zKmsJwkPublicEcdh, zKmsKeyAgreementEcdhEs } from './KmsKeyAgreementEncryptOptions'
import { zKmsKeyId } from './common'

const zKmsKeyAgreementDecryptEcdhEsKw = z.object({
  /**
   * The key id pointing to the ephemeral public key.
   *
   * The key type MUST match with the externalPublicJwk
   */
  keyId: zKmsKeyId,

  algorithm: z.enum(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW']),

  externalPublicJwk: zKmsJwkPublicEcdh,

  /**
   * The encrypted content encryption key (cek)
   */
  encryptedKey: zKmsEncryptedKey,

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsKeyAgreementDecryptEcdhEsKw = z.output<typeof zKmsKeyAgreementDecryptEcdhEsKw>

const zKmsKeyAgreementDecryptEcdhHsalsa20 = z.object({
  /**
   * The key id to use for decrypting the content encryption key.
   */
  keyId: zKmsKeyId,

  /**
   * Perform key agreement based on the HSALSA20 as used in Libsodium's
   * Cryptobox. This is not based on an official JWA algorithm, but is
   * used primarily for DIDComm v1 messaging.
   */
  algorithm: z.literal('ECDH-HSALSA20'),

  /**
   * Can be undefined for anonymous encryption
   */
  externalPublicJwk: zKmsJwkPublicOkp.extend({ crv: zKmsJwkPublicOkp.shape.crv.extract(['X25519']) }).optional(),
})
export type KmsKeyAgreementDecryptEcdhHsalsa20 = z.output<typeof zKmsKeyAgreementDecryptEcdhHsalsa20>

export const zKmsKeyAgreementDecryptOptions = z
  .discriminatedUnion('algorithm', [
    zKmsKeyAgreementEcdhEs,
    zKmsKeyAgreementDecryptEcdhEsKw,
    zKmsKeyAgreementDecryptEcdhHsalsa20,
  ])
  .describe('Options for key agreement based on an assymetric key.')
export type KmsKeyAgreementDecryptOptions = z.output<typeof zKmsKeyAgreementDecryptOptions>
