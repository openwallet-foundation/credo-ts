import { Buffer } from '../utils'

import { KeyType } from './KeyType'

export function isValidSeed(seed: Buffer, keyType: KeyType): boolean {
  const minimumSeedLength = {
    [KeyType.Ed25519]: 32,
    [KeyType.X25519]: 32,
    [KeyType.Bls12381g1]: 32,
    [KeyType.Bls12381g2]: 32,
    [KeyType.Bls12381g1g2]: 32,
    [KeyType.P256]: 64,
    [KeyType.P384]: 64,
    [KeyType.P521]: 64,
    [KeyType.K256]: 64,
  } as const

  return Buffer.isBuffer(seed) && seed.length >= minimumSeedLength[keyType]
}

export function isValidPrivateKey(privateKey: Buffer, keyType: KeyType): boolean {
  const privateKeyLength = {
    [KeyType.Ed25519]: 32,
    [KeyType.X25519]: 32,
    [KeyType.Bls12381g1]: 32,
    [KeyType.Bls12381g2]: 32,
    [KeyType.Bls12381g1g2]: 32,
    [KeyType.P256]: 32,
    [KeyType.P384]: 48,
    [KeyType.P521]: 66,
    [KeyType.K256]: 32,
  } as const

  return Buffer.isBuffer(privateKey) && privateKey.length === privateKeyLength[keyType]
}

export function isSigningSupportedForKeyType(keyType: KeyType): boolean {
  const keyTypeSigningSupportedMapping = {
    [KeyType.Ed25519]: true,
    [KeyType.X25519]: false,
    [KeyType.P256]: true,
    [KeyType.P384]: true,
    [KeyType.P521]: true,
    [KeyType.Bls12381g1]: true,
    [KeyType.Bls12381g2]: true,
    [KeyType.Bls12381g1g2]: true,
    [KeyType.K256]: true,
  } as const

  return keyTypeSigningSupportedMapping[keyType]
}

export function isEncryptionSupportedForKeyType(keyType: KeyType): boolean {
  const keyTypeEncryptionSupportedMapping = {
    [KeyType.Ed25519]: false,
    [KeyType.X25519]: true,
    [KeyType.P256]: true,
    [KeyType.P384]: true,
    [KeyType.P521]: true,
    [KeyType.Bls12381g1]: false,
    [KeyType.Bls12381g2]: false,
    [KeyType.Bls12381g1g2]: false,
    [KeyType.K256]: true,
  } as const

  return keyTypeEncryptionSupportedMapping[keyType]
}
