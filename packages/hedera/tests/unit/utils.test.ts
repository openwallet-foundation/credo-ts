import type { DidDocument, Key } from '@credo-ts/core'
import type { PublicKey } from '@hashgraph/sdk'

import { getKeyFromVerificationMethod } from '@credo-ts/core'
import { DID_ROOT_KEY_ID, KeysUtility } from '@hiero-did-sdk/core'

import { mockFunction } from '../../../core/tests/helpers'
import { getRootKeyForHederaDid, hederaPublicKeyFromCredoKey } from '../../src/ledger/utils'

jest.mock('@hiero-did-sdk/core', () => ({
  KeysUtility: {
    fromBytes: jest.fn(),
  },
  DID_ROOT_KEY_ID: '#did-root-key',
}))

jest.mock('@credo-ts/core', () => ({
  ...jest.requireActual('@credo-ts/core'),
  getKeyFromVerificationMethod: jest.fn(),
}))

describe('hederaPublicKeyFromCredoKey', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should convert Credo key to Hedera PublicKey', () => {
    const mockPublicKey = { toPublicKey: jest.fn() } as unknown as ReturnType<typeof KeysUtility.fromBytes>
    const mockHederaPublicKey = {} as PublicKey

    mockFunction(mockPublicKey.toPublicKey).mockReturnValue(mockHederaPublicKey)
    mockFunction(KeysUtility.fromBytes).mockReturnValue(mockPublicKey)

    const key = {
      publicKey: new Uint8Array([1, 2, 3, 4, 5]),
    } as Key

    const result = hederaPublicKeyFromCredoKey(key)

    expect(KeysUtility.fromBytes).toHaveBeenCalledWith(key.publicKey)
    expect(mockPublicKey.toPublicKey).toHaveBeenCalled()
    expect(result).toBe(mockHederaPublicKey)
  })
})

describe('getRootKeyForHederaDid', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return the root key from DID document', () => {
    const mockRootKey = { publicKey: new Uint8Array([1, 2, 3, 4, 5]) } as Key
    const mockVerificationMethod = {
      id: `did:hedera:testnet:z6MkrBdNdwUPnXDVD1DCxufk3zxjYvRsAGFzQtpn7eR5sUVF${DID_ROOT_KEY_ID}`,
      type: 'Ed25519VerificationKey2018',
      controller: 'did:hedera:testnet:z6MkrBdNdwUPnXDVD1DCxufk3zxjYvRsAGFzQtpn7eR5sUVF',
      publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
    }

    const mockDidDocument = {
      verificationMethod: [mockVerificationMethod],
    } as DidDocument

    mockFunction(getKeyFromVerificationMethod).mockReturnValue(mockRootKey)

    const result = getRootKeyForHederaDid(mockDidDocument)

    expect(getKeyFromVerificationMethod).toHaveBeenCalledWith(mockVerificationMethod)
    expect(result).toBe(mockRootKey)
  })

  it('should throw an error when root key is not found in DID document', () => {
    const mockDidDocument = {
      verificationMethod: [
        {
          id: 'did:hedera:testnet:z6MkrBdNdwUPnXDVD1DCxufk3zxjYvRsAGFzQtpn7eR5sUVF#other-key',
          type: 'Ed25519VerificationKey2018',
          controller: 'did:hedera:testnet:z6MkrBdNdwUPnXDVD1DCxufk3zxjYvRsAGFzQtpn7eR5sUVF',
          publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
        },
      ],
    } as DidDocument

    expect(() => getRootKeyForHederaDid(mockDidDocument)).toThrow('The root key is not found in DID document')
  })

  it('should throw an error when verification method exists but root key cannot be extracted', () => {
    // Mock data
    const mockVerificationMethod = {
      id: `did:hedera:testnet:z6MkrBdNdwUPnXDVD1DCxufk3zxjYvRsAGFzQtpn7eR5sUVF${DID_ROOT_KEY_ID}`,
      type: 'Ed25519VerificationKey2018',
      controller: 'did:hedera:testnet:z6MkrBdNdwUPnXDVD1DCxufk3zxjYvRsAGFzQtpn7eR5sUVF',
      publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
    }

    const mockDidDocument = {
      verificationMethod: [mockVerificationMethod],
    } as DidDocument

    // @ts-expect-error Synthetic case with a null result
    mockFunction(getKeyFromVerificationMethod).mockReturnValue(null)

    expect(() => getRootKeyForHederaDid(mockDidDocument)).toThrow('The root key is not found in DID document')
  })

  it('should throw an error when DID document has no verification methods', () => {
    const mockDidDocument = {
      verificationMethod: undefined,
    } as DidDocument

    expect(() => getRootKeyForHederaDid(mockDidDocument)).toThrow('The root key is not found in DID document')
  })
})
