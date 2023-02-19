import { Buffer } from '../utils'

import { KeyType } from './KeyType'

export function isValidSeed(seed: Buffer, keyType: KeyType): boolean {
  const minimumSeedLength: Record<KeyType, number> = {
    [KeyType.Ed25519]: 32,
    [KeyType.X25519]: 32,
    [KeyType.Bls12381g1]: 32,
    [KeyType.Bls12381g2]: 32,
    [KeyType.Bls12381g1g2]: 32,
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
  }

  return Buffer.isBuffer(privateKey) && privateKey.length === privateKeyLength[keyType]
}
