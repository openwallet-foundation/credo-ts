import { DidDocument, DidRepository } from '@credo-ts/core'

import { InMemoryWallet } from '../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { mockResolvedDidDocument, mockResolvedDidRecord } from '../../anoncreds/services/__tests__/mock-resources'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'

// Mock DidsApi
const mockDidsRepository = {
  findSingleByQuery: jest.fn(),
  getSingleByQuery: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
}
const wallet = new InMemoryWallet()

describe('WebVhDidRegistrar Integration Tests', () => {
  let registrar: WebVhDidRegistrar
  let agentContext: ReturnType<typeof getAgentContext>

  beforeEach(async () => {
    // Reset only the storage (DidRepository) mocks before each test
    jest.clearAllMocks()

    // Create a real resolver instance
    registrar = new WebVhDidRegistrar()

    // Create a fresh agent context
    const agentConfig = getAgentConfig('WebVhDidRegistrarIntegrationTest')
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [[DidRepository, mockDidsRepository]],
      wallet,
    })
    await wallet.createAndOpen(agentConfig.walletConfig)
  })

  afterEach(async () => {
    if (wallet.isInitialized) {
      await wallet.close()
    }
    await wallet.delete()
  })

  describe('DID WebVH creation', () => {
    it('should correctly create a new did webvh', async () => {
      mockDidsRepository.findSingleByQuery.mockResolvedValue(null)
      mockDidsRepository.save.mockResolvedValue(undefined)

      const result = await registrar.create(agentContext, { domain: 'id.test-suite.app' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: expect.objectContaining({
          state: 'finished',
          didDocument: expect.any(Object),
        }),
      })

      expect(result.didState.did).toMatch(/^did:webvh:.+/)
      expect(result.didState.didDocument?.context).toEqual([
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ])
      expect(result.didState.didDocument?.id).toMatch(/^did:webvh:.+/)
      expect(result.didState.didDocument?.controller).toMatch(/^did:webvh:.+/)
      expect(result.didState.didDocument?.authentication?.[0]).toMatch(/^did:webvh:.+/)

      const verification = result.didState.didDocument?.verificationMethod?.[0]
      expect(verification?.id).toMatch(/^did:webvh:.+/)
      expect(verification?.controller).toMatch(/^did:webvh:.+/)
    })

    it('should fail if DID record already exists', async () => {
      mockDidsRepository.findSingleByQuery.mockResolvedValue(mockResolvedDidRecord)

      const domain = 'id.test-suite.app'
      const result = await registrar.create(agentContext, { domain })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `A record with domain "${domain}" already exists.`,
        },
      })
    })
  })

  describe('DID WebVH update', () => {
    const did = mockResolvedDidDocument.id
    const didDocument = new DidDocument(mockResolvedDidDocument as unknown as DidDocument)

    it('should fail if DID record already exists', async () => {
      mockDidsRepository.getSingleByQuery.mockResolvedValue(undefined)

      const result = await registrar.update(agentContext, { did, didDocument })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `DID not found`,
        },
      })
    })
  })
})
