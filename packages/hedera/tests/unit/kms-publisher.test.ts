const mockPublicJwk = {
  keyId: 'test-key-id',
  publicKey: { publicKey: new Uint8Array([1, 2, 3]) },
} as Kms.PublicJwk<Kms.Ed25519PublicJwk>

import { AgentContext, Kms } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'
import { KmsPublisher } from '../../src/ledger/publisher/KmsPublisher'

jest.mock('@credo-ts/core', () => ({
  ...jest.requireActual('@credo-ts/core'),
  Kms: {
    KeyManagementApi: jest.fn().mockReturnValue({}),
    PublicJwk: {
      fromFingerprint: jest.fn().mockReturnValue(mockPublicJwk),
    },
  },
}))

jest.mock('../../src/ledger/utils', () => ({
  createOrGetKey: jest.fn(),
  hederaPublicKeyFromPublicJwk: jest.fn(),
}))

import { PublicKey } from '@hashgraph/sdk'
import { createOrGetKey, hederaPublicKeyFromPublicJwk } from '../../src/ledger/utils'

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

  const mockPublicKey = {}

  beforeEach(() => {
    jest.clearAllMocks()
    mockFunction(hederaPublicKeyFromPublicJwk).mockReturnValue(mockPublicKey as PublicKey)

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
    const publisher = new KmsPublisher(agentContext as any, mockClient as any, mockPublicJwk)
    expect(agentContext.dependencyManager.resolve).toHaveBeenCalledWith(expect.anything())
    expect(publisher.publicKey()).toBe(mockPublicKey)
  })

  it('should correctly update key in setKeyId', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const publisher = new KmsPublisher(agentContext as unknown as AgentContext, mockClient as any, mockPublicJwk)
    await publisher.setKeyId('new-key-id')

    expect(createOrGetKey).toHaveBeenCalledWith(kmsMock, 'new-key-id')
    expect(hederaPublicKeyFromPublicJwk).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const publisher = new KmsPublisher(agentContext as unknown as AgentContext, mockClient as any, mockPublicJwk)
    expect(publisher.publicKey()).toBe(mockPublicKey)
  })
})
