import * as z from '../../../utils/zod'
import { vKnownJwaContentEncryptionAlgorithm } from '../jwk/jwa'
import { vKmsJwkPublicEc } from '../jwk/kty/ec'
import { vKmsJwkPublicOkp } from '../jwk/kty/okp'

const vKmsDeriveKeyEcdhEs = z.object({
  algorithm: z.literal('ECDH-ES'),

  encryptionAlgorithm: vKnownJwaContentEncryptionAlgorithm,

  publicJwk: z.union([vKmsJwkPublicOkp, vKmsJwkPublicEc]),

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsDeriveKeyEcdhEs = z.output<typeof vKmsDeriveKeyEcdhEs>

const vKmsDeriveKeyEcdhEsKw = z.object({
  algorithm: z.enum(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW']),

  publicJwk: z.union([vKmsJwkPublicOkp, vKmsJwkPublicEc]),

  apu: z.optional(z.instanceof(Uint8Array)),
  apv: z.optional(z.instanceof(Uint8Array)),
})
export type KmsDeriveKeyEcdhEsKw = z.output<typeof vKmsDeriveKeyEcdhEsKw>

const vKmsDeriveKeyEcdhHsalsa20 = z.object({
  keyId: z.optional(z.string()),

  algorithm: z.literal('ECDH-HSALSA20'),

  // Only X25519 is supported for crypto_box_seal
  publicJwk: vKmsJwkPublicOkp,
})
export type KmsDeriveKeyEcdhHsalsa20 = z.output<typeof vKmsDeriveKeyEcdhHsalsa20>

export const vKmsDeriveKeyOptions = z.discriminatedUnion('algorithm', [
  vKmsDeriveKeyEcdhEs,
  vKmsDeriveKeyEcdhEsKw,
  vKmsDeriveKeyEcdhHsalsa20,
])
export type KmsDeriveKeyOptions = z.output<typeof vKmsDeriveKeyOptions>
