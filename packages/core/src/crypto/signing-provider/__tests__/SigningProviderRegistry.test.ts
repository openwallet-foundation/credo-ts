import type { Buffer } from '../../../utils/buffer'
import type { KeyPair, SigningProvider } from '../SigningProvider'

import { KeyType } from '../../KeyType'
import { SigningProviderRegistry } from '../SigningProviderRegistry'

class SigningProviderMock implements SigningProvider {
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

const signingProvider = new SigningProviderMock()
const signingProviderRegistry = new SigningProviderRegistry([signingProvider])

describe('SigningProviderRegistry', () => {
  describe('hasProviderForKeyType', () => {
    test('returns true if the key type is registered', () => {
      expect(signingProviderRegistry.hasProviderForKeyType(KeyType.Bls12381g2)).toBe(true)
    })

    test('returns false if the key type is not registered', () => {
      expect(signingProviderRegistry.hasProviderForKeyType(KeyType.Ed25519)).toBe(false)
    })
  })

  describe('getProviderForKeyType', () => {
    test('returns the correct provider  true if the key type is registered', () => {
      expect(signingProviderRegistry.getProviderForKeyType(KeyType.Bls12381g2)).toBe(signingProvider)
    })

    test('throws error if the key type is not registered', () => {
      expect(() => signingProviderRegistry.getProviderForKeyType(KeyType.Ed25519)).toThrowError(
        'No signing key provider for key type: ed25519'
      )
    })
  })
})
