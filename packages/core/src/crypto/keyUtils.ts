import { Buffer } from '../utils'

import { KeyType } from './KeyType'

export function isValidSeed(seed: Buffer, keyType: KeyType): boolean {
  const minimumSeedLength: Record<KeyType, number> = {
    [KeyType.Ed25519]: 32,
    [KeyType.X25519]: 32,
    [KeyType.Bls12381g1]: 32,
    [KeyType.Bls12381g2]: 32,
    [KeyType.Bls12381g1g2]: 32,
    [KeyType.P256]: 64,
    [KeyType.P384]: 64,
    [KeyType.P521]: 64,
  }

  return Buffer.isBuffer(seed) && seed.length >= minimumSeedLength[keyType]
}

export function isValidPrivateKey(privateKey: Buffer, keyType: KeyType): boolean {
  const privateKeyLength: Record<KeyType, number> = {
    [KeyType.Ed25519]: 32,
    [KeyType.X25519]: 32,
    [KeyType.Bls12381g1]: 32,
    [KeyType.Bls12381g2]: 32,
    [KeyType.Bls12381g1g2]: 32,
    [KeyType.P256]: 32,
    [KeyType.P384]: 48,
    [KeyType.P521]: 66,
  }

  return Buffer.isBuffer(privateKey) && privateKey.length === privateKeyLength[keyType]
}
