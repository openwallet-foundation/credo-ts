import * as v from '../../../utils/valibot'

export const vKnownJwaSignatureAlgorithms = {
  HS256: v.literal('HS256'),
  HS384: v.literal('HS384'),
  HS512: v.literal('HS512'),
  RS256: v.literal('RS256'),
  RS384: v.literal('RS384'),
  RS512: v.literal('RS512'),
  ES256: v.literal('ES256'),
  ES384: v.literal('ES384'),
  ES512: v.literal('ES512'),
  PS256: v.literal('PS256'),
  PS384: v.literal('PS384'),
  PS512: v.literal('PS512'),
  EdDSA: v.literal('EdDSA'),
  ES256K: v.literal('ES256K'),
} as const
export const vKnownJwaSignatureAlgorithm = v.union(Object.values(vKnownJwaSignatureAlgorithms))
export type KnownJwaSignatureAlgorithm = v.InferOutput<typeof vKnownJwaSignatureAlgorithm>

// Content encryption algorithms ("enc" parameter)
export const vKnownJwaContentEncryptionAlgorithms = {
  // AES-GCM Content Encryption
  A128GCM: v.literal('A128GCM'),
  A192GCM: v.literal('A192GCM'),
  A256GCM: v.literal('A256GCM'),

  // AES-CBC Content Encryption
  A128CBC: v.literal('A128CBC'),
  A256CBC: v.literal('A256CBC'),

  // ChaCha20-Poly1305
  C20P: v.literal('C20P'),
  XC20P: v.literal('XC20P'),

  A128CBC_HS256: v.literal('A128CBC-HS256'),
  A192CBC_HS384: v.literal('A192CBC-HS384'),
  A256CBC_HS512: v.literal('A256CBC-HS512'),
} as const
export const vKnownJwaContentEncryptionAlgorithm = v.union(Object.values(vKnownJwaContentEncryptionAlgorithms))
export type KnownJwaContentEncryptionAlgorithm = v.InferOutput<typeof vKnownJwaContentEncryptionAlgorithm>

export const vKnownJwaKeyEncryptionAlgorithms = {
  // AES Key Wrapping
  A128KW: v.literal('A128KW'),
  A192KW: v.literal('A192KW'),
  A256KW: v.literal('A256KW'),
} as const
const vKnownJwaKeyEncryptionAlgorithm = v.union(Object.values(vKnownJwaKeyEncryptionAlgorithms))
export type KnownJwaKeyEncryptionAlgorithm = v.InferOutput<typeof vKnownJwaKeyEncryptionAlgorithm>

// Key derivation / wrapping algorithms ("alg" parameter)
export const vKnownJwaKeyManagementAlgorithms = {
  // ECDH-ES with P-256/P-384/P-521
  ECDH_ES: v.literal('ECDH-ES'),
  ECDH_ES_A128KW: v.literal('ECDH-ES+A128KW'),
  ECDH_ES_A192KW: v.literal('ECDH-ES+A192KW'),
  ECDH_ES_A256KW: v.literal('ECDH-ES+A256KW'),

  ECDH_HSALSA20: v.literal('ECDH-HSALSA20'),
} as const
const vKnownJwaKeyManagementAlgorithm = v.union(Object.values(vKnownJwaKeyManagementAlgorithms))
export type KnownJwaKeyManagementAlgorithm = v.InferOutput<typeof vKnownJwaKeyManagementAlgorithm>
