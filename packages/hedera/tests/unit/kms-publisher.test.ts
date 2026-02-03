import type { AgentContext } from '@credo-ts/core'
import type { Client } from '@hashgraph/sdk'

import { Key, KeyType } from '@credo-ts/core'
import { PrivateKey } from '@hashgraph/sdk'

import { mockFunction } from '../../../core/tests/helpers'
import { CredoPublisher } from '../../src/ledger/publisher/CredoPublisher'
import { hederaPublicKeyFromCredoKey } from '../../src/ledger/utils'

jest.mock('../../src/ledger/utils', () => ({
  hederaPublicKeyFromCredoKey: jest.fn(),
}))

jest.mock('@hiero-did-sdk/publisher-internal', () => {
  return {
    Publisher: jest.fn(),
  }
})

const hederaPrivateKey = PrivateKey.generateED25519()
const publicKey: Key = Key.fromPublicKey(hederaPrivateKey.publicKey.toBytesRaw(), KeyType.Ed25519)

describe('KmsPublisher', () => {
  const mockClient = {
    freezeWith: jest.fn(),
    signWith: jest.fn(),
    execute: jest.fn(),
    operator: {
      accountId: '0.0.1234',
      publicKey: {},
    },
  } as unknown as Client

  const mockFrozenTransaction = {
    signWith: jest.fn(),
  }

  const mockResponse = {
    getReceipt: jest.fn(),
  }

  const signMock = jest.fn().mockResolvedValue({ signature: 'signature-bytes' })

  const mockAgentContext: AgentContext = {
    wallet: {
      sign: signMock,
    },
  } as unknown as AgentContext

  const mockPublicKey = hederaPrivateKey.publicKey

  beforeEach(() => {
    jest.clearAllMocks()
    mockFunction(hederaPublicKeyFromCredoKey).mockReturnValue(mockPublicKey)

    mockFrozenTransaction.signWith.mockImplementation(async (_publicKey, signCallback) => {
      const signature = await signCallback(new Uint8Array([4, 5, 6]))
      expect(signature).toBe('signature-bytes')
      return
    })

    mockResponse.getReceipt.mockResolvedValue('receipt-object')
  })

  it('should correctly create an instance via constructor', () => {
    const publisher = new CredoPublisher(mockAgentContext, mockClient, publicKey)
    expect(publisher.publicKey()).toBe(mockPublicKey)
  })

  it('should correctly update key in setKey', async () => {
    const newKey = Key.fromPublicKey(PrivateKey.generateED25519().publicKey.toBytesRaw(), KeyType.Ed25519)

    const publisher = new CredoPublisher(mockAgentContext, mockClient, publicKey)
    await publisher.setKey(newKey)

    expect(hederaPublicKeyFromCredoKey).toHaveBeenCalledWith(newKey)
    expect(hederaPublicKeyFromCredoKey).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', () => {
    const publisher = new CredoPublisher(mockAgentContext, mockClient, publicKey)
    expect(publisher.publicKey()).toBe(mockPublicKey)
  })
})
