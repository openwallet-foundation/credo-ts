import { AgentContext, Kms } from '@credo-ts/core'
import { Client, PublicKey } from '@hashgraph/sdk'
import { PublicJwk } from '../../../core/src/modules/kms/jwk/PublicJwk'
import { mockFunction } from '../../../core/tests/helpers'
import { KmsPublisher } from '../../src/ledger/publisher/KmsPublisher'
import { createOrGetKey, hederaPublicKeyFromPublicJwk } from '../../src/ledger/utils'

const mockPublicJwk = {
  keyId: 'test-key-id',
  publicKey: { publicKey: new Uint8Array([1, 2, 3]) },
} as Kms.PublicJwk<Kms.Ed25519PublicJwk>

vi.mock('../../../core/src/modules/kms/jwk/PublicJwk')
vi.mock('../../../core/src/modules/kms/KeyManagementApi')

mockFunction(PublicJwk.fromFingerprint).mockReturnValue(mockPublicJwk)

vi.mock('../../src/ledger/utils', () => ({
  createOrGetKey: vi.fn(),
  hederaPublicKeyFromPublicJwk: vi.fn(),
}))

vi.mock('@hiero-did-sdk/publisher-internal', () => {
  return {
    Publisher: vi.fn(),
  }
})

describe('KmsPublisher', () => {
  const mockClient = {
    freezeWith: vi.fn(),
    signWith: vi.fn(),
    execute: vi.fn(),
    operator: {
      accountId: '0.0.1234',
      publicKey: {},
    },
  }

  const mockFrozenTransaction = {
    signWith: vi.fn(),
  }

  const mockResponse = {
    getReceipt: vi.fn(),
  }

  const signMock = vi.fn().mockResolvedValue({ signature: 'signature-bytes' })

  const kmsMock = {
    sign: signMock,
  }

  const agentContext = {
    dependencyManager: {
      resolve: vi.fn().mockImplementation((key) => {
        if (key === Kms.KeyManagementApi) {
          return kmsMock
        }
        throw new Error(`Unexpected dependency: ${key}`)
      }),
    },
  }

  const mockPublicKey = {}

  beforeEach(() => {
    vi.clearAllMocks()
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
    const publisher = new KmsPublisher(
      agentContext as unknown as AgentContext,
      mockClient as unknown as Client,
      mockPublicJwk
    )
    expect(agentContext.dependencyManager.resolve).toHaveBeenCalledWith(expect.anything())
    expect(publisher.publicKey()).toBe(mockPublicKey)
  })

  it('should correctly update key in setKeyId', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    const publisher = new KmsPublisher(agentContext as unknown as AgentContext, mockClient as any, mockPublicJwk)
    await publisher.setKeyId('new-key-id')

    expect(createOrGetKey).toHaveBeenCalledWith(kmsMock, 'new-key-id')
    expect(hederaPublicKeyFromPublicJwk).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', () => {
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    const publisher = new KmsPublisher(agentContext as unknown as AgentContext, mockClient as any, mockPublicJwk)
    expect(publisher.publicKey()).toBe(mockPublicKey)
  })
})
