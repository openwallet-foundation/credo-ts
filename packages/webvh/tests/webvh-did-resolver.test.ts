import { Agent } from '@credo-ts/core'

import { getInMemoryAgentOptions } from '../../core/tests/helpers'

import { validDid } from './setup'
import { getWebvhModules } from './setupWebvhModule'

// Simplified mock
jest.mock('didwebvh-ts', () => ({
  resolveDID: jest.fn().mockResolvedValue({
    doc: {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:webvh:example.com:z6MkkBaWtQKyx7Mr',
      verificationMethod: [
        {
          id: 'did:webvh:example.com:z6MkkBaWtQKyx7Mr#key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:webvh:example.com:z6MkkBaWtQKyx7Mr',
          publicKeyMultibase: 'z6MkkBaWtQKyx7Mr54XaXyMAEpNKqphK4x7ztuBpSfR6Wqwr',
        },
      ],
      authentication: ['did:webvh:example.com:z6MkkBaWtQKyx7Mr#key-1'],
    },
    did: 'did:webvh:example.com:z6MkkBaWtQKyx7Mr',
  }),
  createDID: jest.fn().mockResolvedValue({
    did: 'did:webvh:example.com:z6MkkBaWtQKyx7Mr',
  }),
  updateDID: jest.fn().mockResolvedValue({
    did: 'did:webvh:example.com:z6MkkBaWtQKyx7Mr',
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
    const agentOptions = getInMemoryAgentOptions('WebVH DID Resolver Test', {}, {}, getWebvhModules())
    agent = new Agent(agentOptions)

    const initPromise = agent.initialize()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Agent initialization timed out')), 5000)
    )

    await Promise.race([initPromise, timeoutPromise])
  })

  afterAll(async () => {
    if (agent) {
      await agent.shutdown()
      await agent.wallet.delete()
    }
  })

  it('should resolve a valid WebVH DID', async () => {
    let err, res
    try {
      const didResolutionResult = await agent.dids.resolve(validDid)
      res = didResolutionResult
    } catch (e) {
      err = e
    }

    expect(err).toBeUndefined()
    expect(res?.didDocument).toBeDefined()
    expect(res?.didDocument?.id).toBe('did:webvh:example.com:z6MkkBaWtQKyx7Mr')
  })
})
