import * as z from '../../../utils/zod'

export const vKnownJwaSignatureAlgorithms = {
  HS256: z.literal('HS256'),
  HS384: z.literal('HS384'),
  HS512: z.literal('HS512'),
  RS256: z.literal('RS256'),
  RS384: z.literal('RS384'),
  RS512: z.literal('RS512'),
  ES256: z.literal('ES256'),
  ES384: z.literal('ES384'),
  ES512: z.literal('ES512'),
  PS256: z.literal('PS256'),
  PS384: z.literal('PS384'),
  PS512: z.literal('PS512'),
  EdDSA: z.literal('EdDSA'),
  ES256K: z.literal('ES256K'),
} as const
export const vKnownJwaSignatureAlgorithm = z.union(Object.values(vKnownJwaSignatureAlgorithms))
export type KnownJwaSignatureAlgorithm = z.output<typeof vKnownJwaSignatureAlgorithm>

// Content encryption algorithms ("enc" parameter)
export const vKnownJwaContentEncryptionAlgorithms = {
  // AES-GCM Content Encryption
  A128GCM: z.literal('A128GCM'),
  A192GCM: z.literal('A192GCM'),
  A256GCM: z.literal('A256GCM'),

  // AES-CBC Content Encryption
  A128CBC: z.literal('A128CBC'),
  A256CBC: z.literal('A256CBC'),

  // ChaCha20-Poly1305
  C20P: z.literal('C20P'),
  XC20P: z.literal('XC20P'),

  A128CBC_HS256: z.literal('A128CBC-HS256'),
  A192CBC_HS384: z.literal('A192CBC-HS384'),
  A256CBC_HS512: z.literal('A256CBC-HS512'),
} as const
export const vKnownJwaContentEncryptionAlgorithm = z.union(Object.values(vKnownJwaContentEncryptionAlgorithms))
export type KnownJwaContentEncryptionAlgorithm = z.output<typeof vKnownJwaContentEncryptionAlgorithm>

export const vKnownJwaKeyEncryptionAlgorithms = {
  // AES Key Wrapping
  A128KW: z.literal('A128KW'),
  A192KW: z.literal('A192KW'),
  A256KW: z.literal('A256KW'),
} as const
const vKnownJwaKeyEncryptionAlgorithm = z.union(Object.values(vKnownJwaKeyEncryptionAlgorithms))
export type KnownJwaKeyEncryptionAlgorithm = z.output<typeof vKnownJwaKeyEncryptionAlgorithm>

// Key derivation / wrapping algorithms ("alg" parameter)
export const vKnownJwaKeyManagementAlgorithms = {
  // ECDH-ES with P-256/P-384/P-521
  ECDH_ES: z.literal('ECDH-ES'),
  ECDH_ES_A128KW: z.literal('ECDH-ES+A128KW'),
  ECDH_ES_A192KW: z.literal('ECDH-ES+A192KW'),
  ECDH_ES_A256KW: z.literal('ECDH-ES+A256KW'),

  ECDH_HSALSA20: z.literal('ECDH-HSALSA20'),
} as const
const vKnownJwaKeyManagementAlgorithm = z.union(Object.values(vKnownJwaKeyManagementAlgorithms))
export type KnownJwaKeyManagementAlgorithm = z.output<typeof vKnownJwaKeyManagementAlgorithm>
