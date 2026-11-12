import {
  AgentConfig,
  CacheModuleConfig,
  DidRepository,
  InjectionSymbols,
  InMemoryLruCache,
  parseDid,
} from '@credo-ts/core'
import { type DidResolutionError, getResolver } from 'didwebvh-ts'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { validDid } from '../../../tests/utils'
import { WebVhDidResolver } from '../WebVhDidResolver'

const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }))

vi.mock('didwebvh-ts', async (importOriginal) => {
  const upstream = await importOriginal<typeof import('didwebvh-ts')>()
  return {
    ...upstream,
    getResolver: vi.fn((config) => {
      const registry = upstream.getResolver(config)
      return { webvh: Object.assign(resolve, { parser: registry.webvh.parser }) }
    }),
  }
})

describe('WebVhDidResolver result mapping', () => {
  let context: ReturnType<typeof getAgentContext>
  const resolver = new WebVhDidResolver()

  beforeEach(() => {
    resolve.mockReset()
    context = getAgentContext({
      agentConfig: getAgentConfig('WebVhDidResolverTest'),
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, new InMemoryStorageService()],
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
      ],
    })
  })

  test.each<DidResolutionError>(['invalidDid', 'invalidDidUrl', 'invalidOptions', 'notFound', 'internalError'])(
    'passes through %s and its structured details without classifying messages',
    async (error) => {
      const upstream = {
        didDocument: null,
        didDocumentMetadata: { witness: { threshold: '2' }, versionId: '1-valid' },
        didResolutionMetadata: {
          error,
          message: '404 not found is text, not an error classification',
          problemDetails: { type: 'https://example.com/detail', title: 'Detail', detail: 'original detail' },
        },
      }
      resolve.mockResolvedValue(upstream)
      expect(await resolver.resolve(context, validDid, parseDid(validDid))).toEqual(upstream)
      expect(getResolver).toHaveBeenCalledWith(expect.objectContaining({ fetch: expect.any(Function) }))
    }
  )

  test('binds upstream fetch to the agent configuration and applies its limits', async () => {
    const networkFetch = vi.fn(async () => new Response('1234'))
    context = getAgentContext({
      agentConfig: new AgentConfig(
        { fetchLimits: { maxResponseBytes: 3 } },
        { ...agentDependencies, fetch: networkFetch }
      ),
    })
    resolve.mockResolvedValue({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    })
    await resolver.resolve(context, validDid, parseDid(validDid))
    const fetch = vi.mocked(getResolver).mock.calls.at(-1)?.[0]?.fetch
    if (!fetch) throw new Error('No agent fetch supplied')
    await expect(fetch('https://example.com')).rejects.toThrow('Response exceeded limit of 3 bytes')
    expect(networkFetch).toHaveBeenCalled()
  })

  test('preserves a selected valid document returned alongside a later-history error', async () => {
    resolve.mockResolvedValue({
      didDocument: { '@context': ['https://www.w3.org/ns/did/v1'], id: validDid },
      didDocumentMetadata: { versionId: '1-valid' },
      didResolutionMetadata: { error: 'invalidDid', message: 'Later entry invalid' },
    })
    const result = await resolver.resolve(context, validDid, parseDid(validDid))
    expect(result.didDocument?.id).toBe(validDid)
    expect(result.didResolutionMetadata).toEqual({ error: 'invalidDid', message: 'Later entry invalid' })
    expect(result.didDocumentMetadata.versionId).toBe('1-valid')
  })

  test('logs unexpected adapter throws and returns internalError with useful context', async () => {
    resolve.mockRejectedValue(new Error('unexpected adapter failure'))
    const logger = vi.spyOn(context.config.logger, 'error')
    const result = await resolver.resolve(context, validDid, parseDid(validDid))
    expect(result.didResolutionMetadata).toMatchObject({
      error: 'internalError',
      message: expect.stringContaining('unexpected adapter failure'),
    })
    expect(logger).toHaveBeenCalled()
  })

  test('does not bypass the upstream result through core document shortcuts', () => {
    expect(resolver.allowsCaching).toBe(false)
    expect(resolver.allowsLocalDidRecord).toBe(false)
    expect(context.resolve(DidRepository)).toBeDefined()
  })

  test('executes upstream parser rejection before resolution or fetch', async () => {
    const did = 'did:webvh:invalid:example.com'
    const fetch = vi.spyOn(context.config, 'fetch')
    const result = await resolver.resolve(context, did, parseDid(did))
    expect(result.didResolutionMetadata.error).toBe('invalidDid')
    expect(resolve).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
