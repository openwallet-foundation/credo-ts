import { KeyType } from './KeyType'

export interface Jwk {
  kty: 'EC' | 'OKP'
  crv: 'Ed25519' | 'X25519' | 'P-256' | 'P-384' | 'P-521' | 'Bls12381G1' | 'Bls12381G2'
  x: string
  y?: string
  use?: 'sig' | 'enc'
}

export interface Ed25519Jwk {
  kty: 'OKP'
  crv: 'Ed25519'
  x: string
  use?: 'sig'
}

export interface Bls12381g1Jwk {
  kty: 'EC'
  crv: 'Bls12381G1'
  x: string
  use?: 'sig'
}

export interface Bls12381g2Jwk {
  kty: 'EC'
  crv: 'Bls12381G2'
  x: string
  use?: 'sig'
}

export interface X25519Jwk {
  kty: 'OKP'
  crv: 'X25519'
  x: string
  use?: 'enc'
}

export interface P256Jwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
  use?: 'sig' | 'enc'
}

export interface P384Jwk {
  kty: 'EC'
  crv: 'P-384'
  x: string
  y: string
  use?: 'sig' | 'enc'
}

export interface P521Jwk {
  kty: 'EC'
  crv: 'P-521'
  x: string
  y: string
  use?: 'sig' | 'enc'
}

export function isEd25519Jwk(jwk: Jwk): jwk is Ed25519Jwk {
  return jwk.kty === 'OKP' && jwk.crv === 'Ed25519' && jwk.x !== undefined && (!jwk.use || jwk.use === 'sig')
}

export function isX25519Jwk(jwk: Jwk): jwk is X25519Jwk {
  return jwk.kty === 'OKP' && jwk.crv === 'X25519' && jwk.x !== undefined && (!jwk.use || jwk.use === 'enc')
}

export function isBls12381g1Jwk(jwk: Jwk): jwk is Bls12381g1Jwk {
  return jwk.kty === 'EC' && jwk.crv === 'Bls12381G1' && jwk.x !== undefined && (!jwk.use || jwk.use === 'sig')
}

export function isBls12381g2Jwk(jwk: Jwk): jwk is Bls12381g2Jwk {
  return jwk.kty === 'EC' && jwk.crv === 'Bls12381G2' && jwk.x !== undefined && (!jwk.use || jwk.use === 'sig')
}

export function isP256Jwk(jwk: Jwk): jwk is P256Jwk {
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    jwk.x !== undefined &&
    jwk.y !== undefined &&
    (!jwk.use || ['sig', 'enc'].includes(jwk.use))
  )
}

export function isP384Jwk(jwk: Jwk): jwk is P384Jwk {
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-384' &&
    jwk.x !== undefined &&
    jwk.y !== undefined &&
    (!jwk.use || ['sig', 'enc'].includes(jwk.use))
  )
}

export function isP521Jwk(jwk: Jwk): jwk is P521Jwk {
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-521' &&
    jwk.x !== undefined &&
    jwk.y !== undefined &&
    (!jwk.use || ['sig', 'enc'].includes(jwk.use))
  )
}

export const jwkCurveToKeyTypeMapping = {
  Ed25519: KeyType.Ed25519,
  X25519: KeyType.X25519,
  'P-256': KeyType.P256,
  'P-384': KeyType.P384,
  'P-521': KeyType.P521,
  Bls12381G1: KeyType.Bls12381g1,
  Bls12381G2: KeyType.Bls12381g2,
} as const

export const keyTypeToJwkCurveMapping = {
  [KeyType.Ed25519]: 'Ed25519',
  [KeyType.X25519]: 'X25519',
  [KeyType.P256]: 'P-256',
  [KeyType.P384]: 'P-384',
  [KeyType.P521]: 'P-521',
  [KeyType.Bls12381g1]: 'Bls12381G1',
  [KeyType.Bls12381g2]: 'Bls12381G2',
} as const

const keyTypeSigningSupportedMapping = {
  [KeyType.Ed25519]: true,
  [KeyType.X25519]: false,
  [KeyType.P256]: true,
  [KeyType.P384]: true,
  [KeyType.P521]: true,
  [KeyType.Bls12381g1]: true,
  [KeyType.Bls12381g2]: true,
  [KeyType.Bls12381g1g2]: true,
} as const

const keyTypeEncryptionSupportedMapping = {
  [KeyType.Ed25519]: false,
  [KeyType.X25519]: true,
  [KeyType.P256]: true,
  [KeyType.P384]: true,
  [KeyType.P521]: true,
  [KeyType.Bls12381g1]: false,
  [KeyType.Bls12381g2]: false,
  [KeyType.Bls12381g1g2]: false,
} as const

export function isSigningSupportedForKeyType(keyType: KeyType): boolean {
  return keyTypeSigningSupportedMapping[keyType]
}

export function isEncryptionSupportedForKeyType(keyType: KeyType): boolean {
  return keyTypeEncryptionSupportedMapping[keyType]
}
