import { getAgentContext } from '../../../../tests/helpers'
import { InMemoryLruCache } from '../InMemoryLruCache'

const agentContext = getAgentContext()

describe('InMemoryLruCache', () => {
  let cache: InMemoryLruCache

  beforeEach(() => {
    cache = new InMemoryLruCache({ limit: 2 })
  })

  it('should set, get and remove a value', async () => {
    expect(await cache.get(agentContext, 'item')).toBeNull()

    await cache.set(agentContext, 'item', 'somevalue')
    expect(await cache.get(agentContext, 'item')).toBe('somevalue')

    await cache.remove(agentContext, 'item')
    expect(await cache.get(agentContext, 'item')).toBeNull()
  })

  it('should remove least recently used entries if entries are added that exceed the limit', async () => {
    // Set first value in cache, resolves fine
    await cache.set(agentContext, 'one', 'valueone')
    expect(await cache.get(agentContext, 'one')).toBe('valueone')

    // Set two more entries in the cache. Third item
    // exceeds limit, so first item gets removed
    await cache.set(agentContext, 'two', 'valuetwo')
    await cache.set(agentContext, 'three', 'valuethree')
    expect(await cache.get(agentContext, 'one')).toBeNull()
    expect(await cache.get(agentContext, 'two')).toBe('valuetwo')
    expect(await cache.get(agentContext, 'three')).toBe('valuethree')

    // Get two from the cache, meaning three will be removed first now
    // because it is not recently used
    await cache.get(agentContext, 'two')
    await cache.set(agentContext, 'four', 'valuefour')
    expect(await cache.get(agentContext, 'three')).toBeNull()
    expect(await cache.get(agentContext, 'two')).toBe('valuetwo')
  })

  it('should isolate entries per agent context by default', async () => {
    const contextOne = getAgentContext({ contextCorrelationId: 'contextOne' })
    const contextTwo = getAgentContext({ contextCorrelationId: 'contextTwo' })

    await cache.set(contextOne, 'item', 'somevalue')
    expect(await cache.get(contextTwo, 'item')).toBeNull()
    expect(await cache.get(contextOne, 'item')).toBe('somevalue')

    // Removing from another context should not remove the entry
    await cache.remove(contextTwo, 'item')
    expect(await cache.get(contextOne, 'item')).toBe('somevalue')
  })

  it('should share entries with global scope across agent contexts', async () => {
    const contextOne = getAgentContext({ contextCorrelationId: 'contextOne' })
    const contextTwo = getAgentContext({ contextCorrelationId: 'contextTwo' })

    await cache.set(contextOne, 'item', 'somevalue', undefined, { scope: 'global' })
    expect(await cache.get(contextTwo, 'item', { scope: 'global' })).toBe('somevalue')

    // Global and context scopes are disjoint
    expect(await cache.get(contextOne, 'item')).toBeNull()

    await cache.remove(contextTwo, 'item', { scope: 'global' })
    expect(await cache.get(contextOne, 'item', { scope: 'global' })).toBeNull()
  })

  it('should not collide context-scoped keys with global keys', async () => {
    // context 'x509' with key 'y' must not resolve to the same entry as global key 'x509:y'
    const context = getAgentContext({ contextCorrelationId: 'x509' })

    await cache.set(context, 'y', 'contextvalue')
    expect(await cache.get(context, 'x509:y', { scope: 'global' })).toBeNull()

    await cache.set(context, 'x509:y', 'globalvalue', undefined, { scope: 'global' })
    expect(await cache.get(context, 'y')).toBe('contextvalue')
  })
})
