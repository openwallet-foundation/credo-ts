import * as z from '../../../utils/zod'
import { zKnownJwaContentEncryptionAlgorithm } from '../jwk/jwa'
import { zKmsJwkPublicEc } from '../jwk/kty/ec'
import { zKmsJwkPublicOkp } from '../jwk/kty/okp'

const zKmsDeriveKeyEcdhEs = z.object({
  algorithm: z.literal('ECDH-ES'),

  encryptionAlgorithm: zKnownJwaContentEncryptionAlgorithm,

  publicJwk: z.union([zKmsJwkPublicOkp, zKmsJwkPublicEc]),

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsDeriveKeyEcdhEs = z.output<typeof zKmsDeriveKeyEcdhEs>

const zKmsDeriveKeyEcdhEsKw = z.object({
  algorithm: z.enum(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW']),

  publicJwk: z.union([zKmsJwkPublicOkp, zKmsJwkPublicEc]),

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsDeriveKeyEcdhEsKw = z.output<typeof zKmsDeriveKeyEcdhEsKw>

const zKmsDeriveKeyEcdhHsalsa20 = z.object({
  keyId: z.optional(z.string()),

  algorithm: z.literal('ECDH-HSALSA20'),

  // Only X25519 is supported for crypto_box_seal
  publicJwk: zKmsJwkPublicOkp,
})
export type KmsDeriveKeyEcdhHsalsa20 = z.output<typeof zKmsDeriveKeyEcdhHsalsa20>

export const zKmsDeriveKeyOptions = z.discriminatedUnion('algorithm', [
  zKmsDeriveKeyEcdhEs,
  zKmsDeriveKeyEcdhEsKw,
  zKmsDeriveKeyEcdhHsalsa20,
])
export type KmsDeriveKeyOptions = z.output<typeof zKmsDeriveKeyOptions>
