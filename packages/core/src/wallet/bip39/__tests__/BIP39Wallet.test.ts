/**
 * Unit tests for BIP39 P-256 passkey generation
 */

import { KeyType } from '../../../crypto'
import { CredoError } from '../../../error'
import { Buffer } from '../../../utils'
import {
  createDeterministicP256Key,
  isP256DeterministicRequest,
  enhancedCreateKey,
  type DeterministicP256Options,
  type BIP39WalletCreateKeyOptions,
} from '../BIP39Wallet'

// Mock @algorandfoundation/dp256
const mockGenDerivedMainKeyWithBIP39 = jest.fn().mockResolvedValue(new Uint8Array(32).fill(1))
const mockGenDomainSpecificKeyPair = jest.fn().mockResolvedValue(new Uint8Array(32).fill(2))
const mockGetPurePKBytes = jest.fn().mockReturnValue(new Uint8Array(64).fill(3))

jest.mock('@algorandfoundation/dp256', () => ({
  DeterministicP256: jest.fn().mockImplementation(() => ({
    genDerivedMainKeyWithBIP39: mockGenDerivedMainKeyWithBIP39,
    genDomainSpecificKeyPair: mockGenDomainSpecificKeyPair,
    getPurePKBytes: mockGetPurePKBytes,
  })),
}))

describe('BIP39 P-256 Passkey Generation', () => {
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const TEST_ORIGIN = 'https://example.com'
  const TEST_USER_HANDLE = 'user123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createDeterministicP256Key', () => {
    test('should generate deterministic P-256 key with correct dp256 calls', async () => {
      const options: DeterministicP256Options = {
        mnemonic: TEST_MNEMONIC,
        origin: TEST_ORIGIN,
        userHandle: TEST_USER_HANDLE,
      }

      const result = await createDeterministicP256Key(options)

      // Verify dp256 library calls
      expect(mockGenDerivedMainKeyWithBIP39).toHaveBeenCalledWith(TEST_MNEMONIC)
      expect(mockGenDomainSpecificKeyPair).toHaveBeenCalledWith(
        expect.any(Uint8Array), // mainKey result
        TEST_ORIGIN,
        TEST_USER_HANDLE,
        0 // default counter
      )
      expect(mockGetPurePKBytes).toHaveBeenCalledWith(expect.any(Uint8Array))

      // Verify result is a Key with P-256 type
      expect(result.keyType).toBe(KeyType.P256)
      expect(result.publicKey).toBeDefined()
    })

    test('should use custom counter when provided', async () => {
      const options: DeterministicP256Options = {
        mnemonic: TEST_MNEMONIC,
        origin: TEST_ORIGIN,
        userHandle: TEST_USER_HANDLE,
        counter: 5,
      }

      await createDeterministicP256Key(options)

      expect(mockGenDomainSpecificKeyPair).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        TEST_ORIGIN,
        TEST_USER_HANDLE,
        5
      )
    })

    test('should throw CredoError on dp256 library failure', async () => {
      // Reset and setup the mock to fail
      mockGenDerivedMainKeyWithBIP39.mockRejectedValue(new Error('dp256 error'))

      const options: DeterministicP256Options = {
        mnemonic: TEST_MNEMONIC,
        origin: TEST_ORIGIN,
        userHandle: TEST_USER_HANDLE,
      }

      await expect(createDeterministicP256Key(options)).rejects.toThrow(CredoError)
      await expect(createDeterministicP256Key(options)).rejects.toThrow(
        'Failed to generate deterministic P-256 passkey'
      )

      // Reset the mock for other tests
      mockGenDerivedMainKeyWithBIP39.mockResolvedValue(new Uint8Array(32).fill(1))
    })
  })

  describe('isP256DeterministicRequest', () => {
    test('should return true for P-256 request with p256Options', () => {
      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.P256,
        p256Options: {
          mnemonic: TEST_MNEMONIC,
          origin: TEST_ORIGIN,
          userHandle: TEST_USER_HANDLE,
        },
      }

      expect(isP256DeterministicRequest(options)).toBe(true)
    })

    test('should return false for P-256 request without p256Options', () => {
      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.P256,
      }

      expect(isP256DeterministicRequest(options)).toBe(false)
    })

    test('should return false for non-P-256 request', () => {
      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.Ed25519,
        p256Options: {
          mnemonic: TEST_MNEMONIC,
          origin: TEST_ORIGIN,
          userHandle: TEST_USER_HANDLE,
        },
      }

      expect(isP256DeterministicRequest(options)).toBe(false)
    })
  })

  describe('enhancedCreateKey', () => {
    const mockOriginalCreateKey = jest.fn()

    beforeEach(() => {
      mockOriginalCreateKey.mockClear()
    })

    test('should use deterministic generation for P-256 with p256Options', async () => {
      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.P256,
        p256Options: {
          mnemonic: TEST_MNEMONIC,
          origin: TEST_ORIGIN,
          userHandle: TEST_USER_HANDLE,
        },
      }

      const result = await enhancedCreateKey(mockOriginalCreateKey, options)

      // Should generate deterministic key, not call original
      expect(mockOriginalCreateKey).not.toHaveBeenCalled()
      expect(result.keyType).toBe(KeyType.P256)
      expect(mockGenDerivedMainKeyWithBIP39).toHaveBeenCalledWith(TEST_MNEMONIC)
    })

    test('should delegate to original createKey for non-P-256 keys', async () => {
      const mockKey = { keyType: KeyType.Ed25519, publicKey: Buffer.from('test') }
      mockOriginalCreateKey.mockResolvedValue(mockKey)

      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.Ed25519,
        keyId: 'test-ed25519',
      }

      const result = await enhancedCreateKey(mockOriginalCreateKey, options)

      expect(mockOriginalCreateKey).toHaveBeenCalledWith(options)
      expect(result).toBe(mockKey)
      expect(mockGenDerivedMainKeyWithBIP39).not.toHaveBeenCalled()
    })

    test('should delegate to original createKey for P-256 without p256Options', async () => {
      const mockKey = { keyType: KeyType.P256, publicKey: Buffer.from('test') }
      mockOriginalCreateKey.mockResolvedValue(mockKey)

      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.P256,
        keyId: 'test-p256',
      }

      const result = await enhancedCreateKey(mockOriginalCreateKey, options)

      expect(mockOriginalCreateKey).toHaveBeenCalledWith(options)
      expect(result).toBe(mockKey)
      expect(mockGenDerivedMainKeyWithBIP39).not.toHaveBeenCalled()
    })

    test('should delegate to original createKey for P-256 with undefined p256Options', async () => {
      const mockKey = { keyType: KeyType.P256, publicKey: Buffer.from('test') }
      mockOriginalCreateKey.mockResolvedValue(mockKey)

      const options: BIP39WalletCreateKeyOptions = {
        keyType: KeyType.P256,
        p256Options: undefined,
      }

      const result = await enhancedCreateKey(mockOriginalCreateKey, options)

      expect(mockOriginalCreateKey).toHaveBeenCalledWith(options)
      expect(result).toBe(mockKey)
      expect(mockGenDerivedMainKeyWithBIP39).not.toHaveBeenCalled()
    })
  })
})
