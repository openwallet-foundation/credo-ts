import { z } from 'zod'

function recordToUnion<T>(record: Record<string, T>) {
  return Object.values(record) as [
    (typeof record)[keyof typeof record],
    (typeof record)[keyof typeof record],
    ...(typeof record)[keyof typeof record][],
  ]
}

export const KnownJwaSignatureAlgorithms = {
  HS256: 'HS256',
  HS384: 'HS384',
  HS512: 'HS512',
  RS256: 'RS256',
  RS384: 'RS384',
  RS512: 'RS512',
  ES256: 'ES256',
  ES384: 'ES384',
  ES512: 'ES512',
  PS256: 'PS256',
  PS384: 'PS384',
  PS512: 'PS512',
  EdDSA: 'EdDSA',
  ES256K: 'ES256K',
} as const

export const zKnownJwaSignatureAlgorithm = z.enum(recordToUnion(KnownJwaSignatureAlgorithms))
export type KnownJwaSignatureAlgorithm = z.output<typeof zKnownJwaSignatureAlgorithm>

export function isKnownJwaSignatureAlgorithm(alg: string): alg is KnownJwaSignatureAlgorithm {
  return Object.values(KnownJwaSignatureAlgorithms).includes(alg as keyof typeof KnownJwaSignatureAlgorithms)
}

// Content encryption algorithms ("enc" parameter)
export const KnownJwaContentEncryptionAlgorithms = {
  // AES-GCM Content Encryption
  A128GCM: 'A128GCM',
  A192GCM: 'A192GCM',
  A256GCM: 'A256GCM',

  // AES-CBC Content Encryption
  A128CBC: 'A128CBC',
  A256CBC: 'A256CBC',

  // (X)ChaCha20-Poly1305
  C20P: 'C20P',
  XC20P: 'XC20P',

  /**
   * As is used in DIDComm v1
   */
  'XSALSA20-POLY1305': 'XSALSA20-POLY1305',

  A128CBC_HS256: 'A128CBC-HS256',
  A192CBC_HS384: 'A192CBC-HS384',
  A256CBC_HS512: 'A256CBC-HS512',
} as const
export const zKnownJwaContentEncryptionAlgorithm = z.enum(recordToUnion(KnownJwaContentEncryptionAlgorithms))
export type KnownJwaContentEncryptionAlgorithm = z.output<typeof zKnownJwaContentEncryptionAlgorithm>

export const KnownJwaKeyEncryptionAlgorithms = {
  // AES Key Wrapping
  A128KW: 'A128KW',
  A192KW: 'A192KW',
  A256KW: 'A256KW',
} as const
const zKnownJwaKeyEncryptionAlgorithm = z.enum(recordToUnion(KnownJwaKeyEncryptionAlgorithms))
export type KnownJwaKeyEncryptionAlgorithm = z.output<typeof zKnownJwaKeyEncryptionAlgorithm>

// Key derivation / wrapping algorithms ("alg" parameter)
export const KnownJwaKeyAgreementAlgorithms = {
  // ECDH-ES with P-256/P-384/P-521
  ECDH_ES: 'ECDH-ES',
  ECDH_ES_A128KW: 'ECDH-ES+A128KW',
  ECDH_ES_A192KW: 'ECDH-ES+A192KW',
  ECDH_ES_A256KW: 'ECDH-ES+A256KW',

  ECDH_HSALSA20: 'ECDH-HSALSA20',
} as const
const zKnownJwaKeyAgreementAlgorithm = z.enum(recordToUnion(KnownJwaKeyAgreementAlgorithms))
export type KnownJwaKeyAgreementAlgorithm = z.output<typeof zKnownJwaKeyAgreementAlgorithm>
