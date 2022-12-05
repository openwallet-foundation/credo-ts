import type { Buffer } from '../../../utils/buffer'
import type { KeyProvider, KeyPair } from '../KeyProvider'

import { KeyType } from '../../KeyType'
import { KeyProviderRegistry } from '../KeyProviderRegistry'

class KeyProviderMock implements KeyProvider {
  public readonly keyType = KeyType.Bls12381g2

  public async createKeyPair(): Promise<KeyPair> {
    throw new Error('Method not implemented.')
  }
  public async sign(): Promise<Buffer> {
    throw new Error('Method not implemented.')
  }
  public async verify(): Promise<boolean> {
    throw new Error('Method not implemented.')
  }
}

const keyProvider = new KeyProviderMock()
const keyProviderRegistry = new KeyProviderRegistry([keyProvider])

describe('KeyProviderRegistry', () => {
  describe('hasProviderForKeyType', () => {
    test('returns true if the key type is registered', () => {
      expect(keyProviderRegistry.hasProviderForKeyType(KeyType.Bls12381g2)).toBe(true)
    })

    test('returns false if the key type is not registered', () => {
      expect(keyProviderRegistry.hasProviderForKeyType(KeyType.Ed25519)).toBe(false)
    })
  })

  describe('getProviderForKeyType', () => {
    test('returns the correct provider  true if the key type is registered', () => {
      expect(keyProviderRegistry.getProviderForKeyType(KeyType.Bls12381g2)).toBe(keyProvider)
    })

    test('throws error if the key type is not registered', () => {
      expect(() => keyProviderRegistry.getProviderForKeyType(KeyType.Ed25519)).toThrowError(
        'No key provider for key type: ed25519'
      )
    })
  })
})
