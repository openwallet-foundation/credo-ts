import { Agent } from '@credo-ts/core'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { getAgentOptions } from '../../core/tests/helpers'

import { getWebVhModules } from './setupWebVhModule'
import { validDid } from './utils'

// Simplified partial mock. Keep unmocked exports (e.g. multibaseEncode) for registrar internals.
vi.mock('didwebvh-ts', async () => {
  const actual = await vi.importActual<typeof import('didwebvh-ts')>('didwebvh-ts')

  return {
    ...actual,
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
      doc: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
        verificationMethod: [
          {
            id: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example#key-1',
            type: 'Multikey',
            controller: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
            publicKeyMultibase: 'z6MkkBaWtQKyx7Mr54XaXyMAEpNKqphK4x7ztuBpSfR6Wqwr',
          },
        ],
        authentication: ['did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example#key-1'],
        assertionMethod: ['did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example#key-1'],
        keyAgreement: ['did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example#key-1'],
      },
      did: 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example',
      log: [],
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
  }
})

describe('WebVH DID module', () => {
  let agent: Agent<ReturnType<typeof getWebVhModules>>

  beforeAll(async () => {
    const agentOptions = getAgentOptions('WebVH DID Module Test', {}, {}, getWebVhModules())
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

  it('should register a webvh DID through the configured registrar', async () => {
    const didCreateResult = await agent.dids.create({ method: 'webvh', domain: 'domain.example' })

    expect(didCreateResult.didState.state).toBe('finished')

    if (didCreateResult.didState.state === 'finished') {
      expect(didCreateResult.didState.did).toBe('did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example')
    }

    const createdDids = await agent.dids.getCreatedDids({ method: 'webvh' })
    expect(createdDids.some((record) => record.did === didCreateResult.didState.did)).toBe(true)
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
