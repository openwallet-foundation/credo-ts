import { Agent } from '@credo-ts/core'

import { getInMemoryAgentOptions } from '../../core/tests/helpers'

import { getWebvhModules } from './setupWebvhModule'
import { validDid } from './utils'

// Simplified mock
jest.mock('didwebvh-ts', () => ({
  resolveDID: jest.fn().mockResolvedValue({
    doc: {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
      verificationMethod: [
        {
          id: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example#key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
          publicKeyMultibase: 'z6MkkBaWtQKyx7Mr54XaXyMAEpNKqphK4x7ztuBpSfR6Wqwr',
        },
      ],
      authentication: ['did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example#key-1'],
    },
    did: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
  }),
  createDID: jest.fn().mockResolvedValue({
    did: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
  }),
  updateDID: jest.fn().mockResolvedValue({
    did: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
  }),
  AbstractCrypto: jest.fn().mockImplementation(() => ({
    sign: jest.fn().mockResolvedValue({
      signature: 'signature',
    }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}))

describe('WebVH DID resolver', () => {
  let agent: Agent<ReturnType<typeof getWebvhModules>>

  beforeAll(async () => {
    const agentOptions = getInMemoryAgentOptions('WebVH DID Resolver Test', {}, getWebvhModules())
    agent = new Agent(agentOptions)

    await agent.initialize()
  })

  afterAll(async () => {
    if (agent) {
      await agent.shutdown()
    }
  })

  it('should resolve a valid WebVH DID', async () => {
    const didResolutionResult = await agent.dids.resolve(validDid)
    expect(didResolutionResult.didDocument).toBeDefined()
    expect(didResolutionResult.didDocument?.id).toBe(
      'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example'
    )
  })
})
