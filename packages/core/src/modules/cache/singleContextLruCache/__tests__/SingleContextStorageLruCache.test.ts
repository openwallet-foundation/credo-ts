import { getAgentContext, mockFunction } from '../../../../../tests/helpers'
import { SingleContextLruCacheRecord } from '../SingleContextLruCacheRecord'
import { SingleContextLruCacheRepository } from '../SingleContextLruCacheRepository'
import { SingleContextStorageLruCache } from '../SingleContextStorageLruCache'

jest.mock('../SingleContextLruCacheRepository')
const SingleContextLruCacheRepositoryMock =
  SingleContextLruCacheRepository as jest.Mock<SingleContextLruCacheRepository>

const cacheRepository = new SingleContextLruCacheRepositoryMock()
const agentContext = getAgentContext({
  registerInstances: [[SingleContextLruCacheRepository, cacheRepository]],
})

describe('SingleContextLruCache', () => {
  let cache: SingleContextStorageLruCache

  beforeEach(() => {
    mockFunction(cacheRepository.findById).mockResolvedValue(null)
    cache = new SingleContextStorageLruCache({ limit: 2 })
  })

  it('should return the value from the persisted record', async () => {
    const findMock = mockFunction(cacheRepository.findById).mockResolvedValue(
      new SingleContextLruCacheRecord({
        id: 'CONTEXT_STORAGE_LRU_CACHE_ID',
        entries: new Map([
          [
            'test',
            {
              value: 'somevalue',
            },
          ],
        ]),
      })
    )

    expect(await cache.get(agentContext, 'doesnotexist')).toBeNull()
    expect(await cache.get(agentContext, 'test')).toBe('somevalue')
    expect(findMock).toHaveBeenCalledWith(agentContext, 'CONTEXT_STORAGE_LRU_CACHE_ID')
  })

  it('should set the value in the persisted record', async () => {
    const updateMock = mockFunction(cacheRepository.update).mockResolvedValue()

    await cache.set(agentContext, 'test', 'somevalue')
    const [[, cacheRecord]] = updateMock.mock.calls

    expect(cacheRecord.entries.size).toBe(1)

    const [[key, item]] = cacheRecord.entries.entries()
    expect(key).toBe('test')
    expect(item.value).toBe('somevalue')

    expect(await cache.get(agentContext, 'test')).toBe('somevalue')
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

  it('should throw an error if used with multiple context correlation ids', async () => {
    // No issue, first call with an agentContext
    await cache.get(agentContext, 'test')

    const secondAgentContext = getAgentContext({
      contextCorrelationId: 'another',
    })

    expect(cache.get(secondAgentContext, 'test')).rejects.toThrow(
      'SingleContextStorageLruCache can not be used with multiple agent context instances. Register a custom cache implementation in the CacheModule.'
    )
  })
})
