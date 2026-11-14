import { Agent, DidsModuleConfig } from '@credo-ts/core'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { getAgentOptions } from '../../core/tests/helpers'
import { WebVhDidResolver } from '../src/dids/WebVhDidResolver'

import { getWebVhModules } from './setupWebVhModule'
import { createWebVhTestOptions } from './utils'

describe('WebVH DID module', () => {
  let agent: Agent<ReturnType<typeof getWebVhModules>>

  it('disables resolver shortcuts regardless of cache scope configuration', () => {
    const resolver = new WebVhDidResolver()
    const config = new DidsModuleConfig({ resolvers: [resolver] })

    expect(resolver.allowsCaching).toBe(false)
    expect(resolver.allowsLocalDidRecord).toBe(false)
    expect(config.getCacheScope('webvh')).toBe('global')
    expect(new DidsModuleConfig({ cacheScope: { webvh: 'context' } }).getCacheScope('webvh')).toBe('context')
  })

  beforeAll(async () => {
    const modules = getWebVhModules()
    const agentOptions = getAgentOptions('WebVH DID Module Test', {}, {}, modules)
    agent = new Agent({ ...agentOptions, modules: { ...modules, inMemory: new InMemoryWalletModule() } })
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })
  afterEach(() => vi.restoreAllMocks())

  it('creates, updates and deactivates through agent.dids with exported WebVH options', async () => {
    const options = await createWebVhTestOptions(agent.context, 'domain.example')
    const created = await agent.dids.create(options)
    expect(created.didState.state).toBe('finished')
    if (created.didState.state !== 'finished') throw new Error('DID create failed')
    const { did, didDocument } = created.didState
    const fetch = vi.spyOn(agent.config, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
    const unpublished = await agent.dids.resolve(did)
    expect(unpublished.didResolutionMetadata.error).toBeDefined()
    expect(unpublished.didDocument).toBeNull()
    const unpublishedLog = await agent.modules.webvh.getPublicationData(did)
    const local = await agent.modules.webvh.resolveDIDFromLog(unpublishedLog.log)
    expect(local.didDocument?.id).toBe(did)
    fetch.mockImplementation(async () => {
      const { log } = await agent.modules.webvh.getPublicationData(did)
      return new Response(log.map((entry) => JSON.stringify(entry)).join('\n'))
    })
    const resolved = await agent.dids.resolve(did)
    expect(resolved.didDocument?.id).toBe(did)
    expect(resolved.didDocumentMetadata.versionId).toBe(created.didDocumentMetadata.versionId)
    const updated = await agent.dids.update({ did, didDocument })
    expect(updated.didState.state).toBe('finished')
    const records = await agent.dids.getCreatedDids({ did })
    expect(records).toHaveLength(1)
    const publication = await agent.modules.webvh.getPublicationData(did)
    expect(publication.log).toHaveLength(2)
    const latest = await agent.dids.resolve(did)
    expect(latest.didDocumentMetadata.versionId).toBe(publication.log[1].versionId)
    const deactivate = await agent.dids.deactivate({ did })
    expect(deactivate.didState.state).toBe('finished')
    const deactivated = await agent.dids.resolve(did)
    expect(deactivated.didDocumentMetadata.deactivated).toBe(true)
    expect(deactivated.didDocument).toBeNull()
    expect(fetch).toHaveBeenCalled()
  })

  it('uses upstream DID URL selectors without core latest-document/cache shortcuts', async () => {
    const created = await agent.dids.create(await createWebVhTestOptions(agent.context, 'versions.example'))
    if (created.didState.state !== 'finished') throw new Error('DID create failed')
    const { did, didDocument } = created.didState
    await agent.dids.update({ did, didDocument })
    const { log } = await agent.modules.webvh.getPublicationData(did)
    const fetch = vi
      .spyOn(agent.config, 'fetch')
      .mockImplementation(
        async () => new Response(log.map((entry) => JSON.stringify(entry)).join('\n'), { status: 200 })
      )
    const resolved = await agent.dids.resolve(`${did}?versionNumber=1`)
    expect(resolved.didDocumentMetadata.versionId).toBe(log[0].versionId)
    expect(fetch).toHaveBeenCalled()
    const conflicting = await agent.dids.resolve(`${did}?versionNumber=1&versionId=${log[0].versionId}`)
    expect(conflicting.didResolutionMetadata.error).toBe('invalidOptions')
  })

  it('resolves ported, encoded resource paths through the configured API', async () => {
    const mockFetch = vi.spyOn(agent.config, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ resourceType: 'schema', id: '1234' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const result = await agent.modules.webvh.resolveResource(
      'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:localhost.example.com%3A8443:some%20path/resources/1234'
    )
    expect(mockFetch).toHaveBeenCalledWith('https://localhost.example.com:8443/some%20path/resources/1234')
    expect(result).toMatchObject({
      content: { resourceType: 'schema', id: '1234' },
      contentMetadata: { contentType: 'application/json' },
      dereferencingMetadata: { contentType: 'application/json' },
    })
  })
})
