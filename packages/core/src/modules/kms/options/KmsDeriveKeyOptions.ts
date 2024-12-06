import * as v from '../../../utils/valibot'
import { vKnownJwaContentEncryptionAlgorithm } from '../jwk/jwa'
import { vKmsJwkPublicEc } from '../jwk/kty/ec'
import { vKmsJwkPublicOkp } from '../jwk/kty/okp'

const vKmsDeriveKeyEcdhEs = v.object({
  algorithm: v.literal('ECDH-ES'),

  encryptionAlgorithm: vKnownJwaContentEncryptionAlgorithm,

  publicJwk: v.union([vKmsJwkPublicOkp, vKmsJwkPublicEc]),

  apu: v.optional(v.instance(Uint8Array)),
  apv: v.optional(v.instance(Uint8Array)),
})
export type KmsDeriveKeyEcdhEs = v.InferOutput<typeof vKmsDeriveKeyEcdhEs>

const vKmsDeriveKeyEcdhEsKw = v.object({
  algorithm: v.union([v.literal('ECDH-ES+A128KW'), v.literal('ECDH-ES+A192KW'), v.literal('ECDH-ES+A256KW')]),

  publicJwk: v.union([vKmsJwkPublicOkp, vKmsJwkPublicEc]),

  apu: v.optional(v.instance(Uint8Array)),
  apv: v.optional(v.instance(Uint8Array)),
})
export type KmsDeriveKeyEcdhEsKw = v.InferOutput<typeof vKmsDeriveKeyEcdhEsKw>

const vKmsDeriveKeyEcdhHsalsa20 = v.object({
  keyId: v.optional(v.string()),

  algorithm: v.literal('ECDH-HSALSA20'),

  // Only X25519 is supported for crypto_box_seal
  publicJwk: vKmsJwkPublicOkp,
})
export type KmsDeriveKeyEcdhHsalsa20 = v.InferOutput<typeof vKmsDeriveKeyEcdhHsalsa20>

export const vKmsDeriveKeyOptions = v.variant('algorithm', [
  vKmsDeriveKeyEcdhEs,
  vKmsDeriveKeyEcdhEsKw,
  vKmsDeriveKeyEcdhHsalsa20,
])
export type KmsDeriveKeyOptions = v.InferOutput<typeof vKmsDeriveKeyOptions>

// export interface KmsDeriveKeyOptions {
//   algorithm: string
// }

// export interface KmsEncryptReturn {
//   /**
//    * The encrypted data, also known as "ciphertext" in JWE
//    */
//   encrypted: Uint8Array

//   /**
//    * Optional authentication tag
//    */
//   tag?: Uint8Array

//   /**
//    * The initialization vector. For algorithms where the iv is required
//    * and not provided, this will contain the auto-generated value.
//    */
//   iv?: Uint8Array
// }
