import { z } from 'zod'

export const KnownCoseSignatureAlgorithms = {
  // EdDSA algorithms - RFC 9864 Section 2.2
  Ed25519: -19,
  Ed448: -53,

  // Deprecated polymorphic EdDSA - RFC 9864 Section 4.1.2
  // Maps to Ed25519 as it's the most common use case (similar to WebAuthn's approach)
  EdDSA: -19,

  // ECDSA algorithms - RFC 9864 Section 2.1
  // JOSE ES256/ES384/ES512 map to fully-specified COSE ESP256/ESP384/ESP512
  ESP256: -9, // COSE ESP256 (ECDSA using P-256 curve and SHA-256)
  ESP384: -51, // COSE ESP384 (ECDSA using P-384 curve and SHA-384)
  ESP512: -52, // COSE ESP512 (ECDSA using P-521 curve and SHA-512)
  ES256K: -47, // ECDSA using secp256k1 curve and SHA-256

  // RSA algorithms - RFC 7518
  RS256: -257, // RSASSA-PKCS1-v1_5 using SHA-256
  RS384: -258, // RSASSA-PKCS1-v1_5 using SHA-384
  RS512: -259, // RSASSA-PKCS1-v1_5 using SHA-512
  PS256: -37, // RSASSA-PSS using SHA-256 and MGF1 with SHA-256
  PS384: -38, // RSASSA-PSS using SHA-384 and MGF1 with SHA-384
  PS512: -39, // RSASSA-PSS using SHA-512 and MGF1 with SHA-512
} as const

export const zKnownCoseSignatureAlgorithm = z.enum(KnownCoseSignatureAlgorithms)
export type KnownCoseSignatureAlgorithm = z.output<typeof zKnownCoseSignatureAlgorithm>

export function isKnownCoseSignatureAlgorithm(coseAlg: number): coseAlg is KnownCoseSignatureAlgorithm {
  return Object.values(KnownCoseSignatureAlgorithms).includes(coseAlg as KnownCoseSignatureAlgorithm)
}
