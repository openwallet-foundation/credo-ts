import { CacheModuleConfig, InMemoryLruCache, SingleContextStorageLruCache } from '@credo-ts/core'
import { getAgentContext } from '../../../../core/tests/helpers'
import { OpenId4VcModuleConfig } from '../../OpenId4VcModuleConfig'
import { getCachedValue, removeCachedValue } from '../router/requestContextCache'

describe('request context cache', () => {
  test('serves a value from the cache of the agent, also without the OpenId4VcModule config', async () => {
    const agentContext = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 10 }) })]],
    })
    const load = vi.fn().mockResolvedValue('value')

    expect(await getCachedValue(agentContext, 'key', load)).toEqual('value')
    expect(await getCachedValue(agentContext, 'key', load)).toEqual('value')
    expect(load).toHaveBeenCalledTimes(1)
  })

  test('does not cache a missing value, so a record created later is found', async () => {
    const agentContext = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 10 }) })]],
    })
    const load = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('value')

    expect(await getCachedValue(agentContext, 'key', load)).toBeNull()
    expect(await getCachedValue(agentContext, 'key', load)).toEqual('value')
    expect(load).toHaveBeenCalledTimes(2)
  })

  test('logs an error instead of throwing when removing a value fails', async () => {
    const cache = new InMemoryLruCache({ limit: 10 })
    const agentContext = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache })]],
    })
    vi.spyOn(cache, 'remove').mockRejectedValue(new Error('Cache unavailable'))
    const error = vi.spyOn(agentContext.config.logger, 'error')

    await expect(removeCachedValue(agentContext, 'key')).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledWith(
      "Error removing 'key' from the cache. The outdated record can be used until it expires after 30 seconds.",
      expect.objectContaining({ error: expect.any(Error) })
    )
  })

  test('is not used when disabled in the OpenId4VcModule config', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 10 }) })],
        [OpenId4VcModuleConfig, new OpenId4VcModuleConfig({ requestContextCache: false })],
      ],
    })
    const load = vi.fn().mockResolvedValue('value')

    await getCachedValue(agentContext, 'key', load)
    await getCachedValue(agentContext, 'key', load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  test('is not used with the SingleContextStorageLruCache, and warns about it once', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [CacheModuleConfig, new CacheModuleConfig({ cache: new SingleContextStorageLruCache({ limit: 10 }) })],
      ],
    })
    const warn = vi.spyOn(agentContext.config.logger, 'warn')
    const load = vi.fn().mockResolvedValue('value')

    await getCachedValue(agentContext, 'key', load)
    await getCachedValue(agentContext, 'key', load)

    expect(load).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
