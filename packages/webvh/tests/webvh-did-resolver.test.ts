import { Agent } from '@credo-ts/core'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { getAgentOptions } from '../../core/tests/helpers'

import { getWebVhModules } from './setupWebVhModule'
import { validDid } from './utils'

// Simplified mock
vi.mock('didwebvh-ts', () => ({
  resolveDID: vi.fn().mockResolvedValue({
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
  createDID: vi.fn().mockResolvedValue({
    did: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
  }),
  updateDID: vi.fn().mockResolvedValue({
    did: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
  }),
  AbstractCrypto: vi.fn().mockImplementation(() => ({
    sign: vi.fn().mockResolvedValue({
      signature: 'signature',
    }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}))

describe('WebVH DID resolver', () => {
  let agent: Agent<ReturnType<typeof getWebVhModules>>

  beforeAll(async () => {
    const agentOptions = getAgentOptions('WebVH DID Resolver Test', {}, {}, getWebVhModules())
    agent = new Agent({ ...agentOptions, modules: { ...getWebVhModules(), inMemory: new InMemoryWalletModule() } })

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

  it('should expose WebVhApi through webvhSdk module', () => {
    expect(typeof agent.modules.webvhSdk.resolveResource).toBe('function')
  })

  it('should resolve a webvh resource through WebVhApi', async () => {
    const mockFetch = vi.spyOn(agent.config.agentDependencies, 'fetch').mockResolvedValue({
      ok: true,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ resourceType: 'schema', id: '1234' }),
      text: async () => '',
    } as unknown as Response)

    const result = await agent.modules.webvhSdk.resolveResource(
      'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:localhost/resources/1234'
    )

    expect(mockFetch).toHaveBeenCalledWith('http://localhost/resources/1234')
    expect(result).toMatchObject({
      content: { resourceType: 'schema', id: '1234' },
      contentMetadata: { contentType: 'application/json' },
      dereferencingMetadata: { contentType: 'application/json' },
    })

    mockFetch.mockRestore()
  })
})
