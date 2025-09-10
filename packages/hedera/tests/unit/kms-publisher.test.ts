import { AgentContext, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { KmsJwkPublicOkp } from '@credo-ts/core/src/modules/kms'
import { KeysUtility } from '@hiero-did-sdk/core'
import { KmsPublisher } from '../../src/ledger/publisher/KmsPublisher'

jest.mock('@hiero-did-sdk/core', () => ({
  KeysUtility: {
    fromBytes: jest.fn(),
  },
  DIDError: class DIDError extends Error {},
}))

jest.mock('@credo-ts/core', () => ({
  TypedArrayEncoder: {
    fromBase64: jest.fn(),
  },
  Kms: {
    KeyManagementApi: jest.fn().mockImplementation(() => ({})),
  },
}))

jest.mock('../../src/ledger/utils', () => ({
  createOrGetKey: jest.fn(),
}))
import { createOrGetKey } from '../../src/ledger/utils'

jest.mock('@hiero-did-sdk/publisher-internal', () => {
  return {
    Publisher: jest.fn(),
  }
})

describe('KmsPublisher', () => {
  const mockClient = {
    freezeWith: jest.fn(),
    signWith: jest.fn(),
    execute: jest.fn(),
    operator: {
      accountId: '0.0.1234',
      publicKey: {},
    },
  }

  const mockFrozenTransaction = {
    signWith: jest.fn(),
  }

  const mockResponse = {
    getReceipt: jest.fn(),
  }

  const signMock = jest.fn().mockResolvedValue({ signature: 'signature-bytes' })

  const kmsMock = {
    sign: signMock,
  }

  const agentContext = {
    dependencyManager: {
      resolve: jest.fn().mockImplementation((key) => {
        if (key === Kms.KeyManagementApi) {
          return kmsMock
        }
        throw new Error(`Unexpected dependency: ${key}`)
      }),
    },
  }

  const keyId = 'test-key-id'
  const base64X = 'base64-x'
  const publicJwk: KmsJwkPublicOkp & { crv: 'Ed25519' } = { x: base64X, crv: 'Ed25519', kty: 'OKP' }
  const key: { keyId: string; publicJwk: KmsJwkPublicOkp & { crv: 'Ed25519' } } = { keyId, publicJwk }

  const mockPublicKey = {
    toPublicKey: jest.fn(),
  }

  const fakePublicKey = {}

  beforeEach(() => {
    jest.clearAllMocks()
    ;(TypedArrayEncoder.fromBase64 as jest.Mock).mockReturnValue(new Uint8Array([1, 2, 3]))
    ;(KeysUtility.fromBytes as jest.Mock).mockReturnValue(mockPublicKey)
    mockPublicKey.toPublicKey.mockReturnValue(fakePublicKey)

    mockClient.freezeWith.mockReturnValue(mockFrozenTransaction)

    mockFrozenTransaction.signWith.mockImplementation(async (_publicKey, signCallback) => {
      const signature = await signCallback(new Uint8Array([4, 5, 6]))
      expect(signature).toBe('signature-bytes')
      return
    })

    mockClient.execute.mockResolvedValue(mockResponse)

    mockResponse.getReceipt.mockResolvedValue('receipt-object')
  })

  it('should correctly create an instance via constructor', () => {
    // biome-ignore lint/suspicious/noExplicitAny:
    const publisher = new KmsPublisher(agentContext as any, mockClient as any, key)
    expect(agentContext.dependencyManager.resolve).toHaveBeenCalledWith(expect.anything())
    expect(publisher.publicKey()).toBe(fakePublicKey)
  })

  it('should correctly update key in setKeyId', async () => {
    ;(createOrGetKey as jest.Mock).mockResolvedValue({
      publicJwk: { x: base64X, crv: 'Ed25519' },
    })

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const publisher = new KmsPublisher(agentContext as unknown as AgentContext, mockClient as any, key)
    await publisher.setKeyId('new-key-id')

    expect(createOrGetKey).toHaveBeenCalledWith(kmsMock, 'new-key-id')
    expect(KeysUtility.fromBytes).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const publisher = new KmsPublisher(agentContext as unknown as AgentContext, mockClient as any, key)
    expect(publisher.publicKey()).toBe(fakePublicKey)
  })
})
