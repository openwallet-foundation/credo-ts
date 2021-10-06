import { mockFunction } from '../../../tests/helpers'
import { CacheRecord } from '../CacheRecord'
import { CacheRepository } from '../CacheRepository'
import { PersistedLruCache } from '../PersistedLruCache'

jest.mock('../CacheRepository')
const CacheRepositoryMock = CacheRepository as jest.Mock<CacheRepository>

describe('PersistedLruCache', () => {
  let cacheRepository: CacheRepository
  let cache: PersistedLruCache<string>

  beforeEach(() => {
    cacheRepository = new CacheRepositoryMock()
    mockFunction(cacheRepository.findById).mockResolvedValue(null)

    cache = new PersistedLruCache('cacheId', 2, cacheRepository)
  })

  it('should return the value from the persisted record', async () => {
    const findMock = mockFunction(cacheRepository.findById).mockResolvedValue(
      new CacheRecord({
        id: 'cacheId',
        entries: [
          {
            key: 'test',
            value: 'somevalue',
          },
        ],
      })
    )

    expect(await cache.get('doesnotexist')).toBeUndefined()
    expect(await cache.get('test')).toBe('somevalue')
    expect(findMock).toHaveBeenCalledWith('cacheId')
  })

  it('should set the value in the persisted record', async () => {
    const saveMock = mockFunction(cacheRepository.save).mockResolvedValue()

    await cache.set('test', 'somevalue')
    const [, [cacheRecord]] = saveMock.mock.calls

    expect(cacheRecord.entries.length).toBe(1)
    expect(cacheRecord.entries[0].key).toBe('test')
    expect(cacheRecord.entries[0].value).toBe('somevalue')

    expect(await cache.get('test')).toBe('somevalue')
  })

  it('should remove least recently used entries if entries are added that exceed the limit', async () => {
    // Set first value in cache, resolves fine
    await cache.set('one', 'valueone')
    expect(await cache.get('one')).toBe('valueone')

    // Set two more entries in the cache. Third item
    // exceeds limit, so first item gets removed
    await cache.set('two', 'valuetwo')
    await cache.set('three', 'valuethree')
    expect(await cache.get('one')).toBeUndefined()
    expect(await cache.get('two')).toBe('valuetwo')
    expect(await cache.get('three')).toBe('valuethree')

    // Get two from the cache, meaning three will be removed first now
    // because it is not recently used
    await cache.get('two')
    await cache.set('four', 'valuefour')
    expect(await cache.get('three')).toBeUndefined()
    expect(await cache.get('two')).toBe('valuetwo')
  })
})
