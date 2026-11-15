import { Subject } from 'rxjs'
import { getAgentConfig, getAgentContext } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { TestRecord } from '../../../storage/__tests__/TestRecord'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'
import { CachedStorageService } from '../CachedStorageService'
import { CacheModuleConfig } from '../CacheModuleConfig'
import { InMemoryLruCache } from '../InMemoryLruCache'

class CachedTestRecord extends TestRecord {
  public static readonly allowCache = true
  public readonly allowCache = true
}

describe('CachedStorageService', () => {
  test('does not cache a record that storage failed to save or update', async () => {
    const cache = new InMemoryLruCache({ limit: 10 })
    const agentContext = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache, useCachedStorageService: true })]],
    })
    const storageService = {
      save: vi.fn().mockRejectedValue(new Error('save failed')),
      update: vi.fn().mockRejectedValue(new Error('update failed')),
    } as unknown as StorageService<CachedTestRecord>
    const cachedStorageService = new CachedStorageService(storageService)
    const record = new CachedTestRecord({ id: 'test-id', foo: 'bar' })

    await expect(cachedStorageService.save(agentContext, record)).rejects.toThrow('save failed')
    await expect(cachedStorageService.update(agentContext, record)).rejects.toThrow('update failed')

    expect(await cache.get(agentContext, `${record.type}:${record.id}`)).toBeNull()
  })

  test('removes an updated record from the cache', async () => {
    const cache = new InMemoryLruCache({ limit: 10 })
    const agentContext = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache, useCachedStorageService: true })]],
    })
    const storageService = { save: vi.fn(), update: vi.fn() } as unknown as StorageService<CachedTestRecord>
    const cachedStorageService = new CachedStorageService(storageService)
    const record = new CachedTestRecord({ id: 'test-id', foo: 'bar' })

    await cachedStorageService.save(agentContext, record)
    await cachedStorageService.update(agentContext, record)
    expect(await cache.get(agentContext, `${record.type}:${record.id}`)).toBeNull()
  })

  test('removes a deleted record from the cache', async () => {
    const cache = new InMemoryLruCache({ limit: 10 })
    const agentContext = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache, useCachedStorageService: true })]],
    })
    const storageService = {
      save: vi.fn(),
      delete: vi.fn(),
      deleteById: vi.fn(),
    } as unknown as StorageService<CachedTestRecord>
    const cachedStorageService = new CachedStorageService(storageService)
    const record = new CachedTestRecord({ id: 'test-id', foo: 'bar' })

    await cachedStorageService.save(agentContext, record)
    await cachedStorageService.delete(agentContext, record)
    expect(await cache.get(agentContext, `${record.type}:${record.id}`)).toBeNull()

    await cachedStorageService.save(agentContext, record)
    await cachedStorageService.deleteById(agentContext, CachedTestRecord, record.id)
    expect(await cache.get(agentContext, `${record.type}:${record.id}`)).toBeNull()
  })

  test('findSingleByQuery with a cache key returns the updated record and skips records that do not allow caching', async () => {
    const storageService = {
      update: vi.fn(),
      findByQuery: vi.fn(),
      getById: vi.fn(),
    } as unknown as StorageService<TestRecord>
    const agentContext = getAgentContext({
      registerInstances: [
        [
          CacheModuleConfig,
          new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 10 }), useCachedStorageService: true }),
        ],
        [CachedStorageService, new CachedStorageService(storageService)],
      ],
    })
    const eventEmitter = new EventEmitter(getAgentConfig('CachedStorageService').agentDependencies, new Subject())

    const record = new CachedTestRecord({ id: 'test-id', foo: 'bar' })
    vi.mocked(storageService.findByQuery).mockResolvedValue([record.clone()])
    vi.mocked(storageService.getById).mockImplementation(async () => record.clone())
    const repository = new Repository<TestRecord>(CachedTestRecord, storageService, eventEmitter)

    await repository.findSingleByQuery(agentContext, { foo: 'bar' }, { cacheKey: 'key' })
    record.foo = 'updated'
    await repository.update(agentContext, record)
    const found = await repository.findSingleByQuery(agentContext, { foo: 'bar' }, { cacheKey: 'key' })

    expect(found?.foo).toEqual('updated')
    expect(storageService.findByQuery).toHaveBeenCalledTimes(1)

    const uncachedRepository = new Repository(TestRecord, storageService, eventEmitter)
    await uncachedRepository.findSingleByQuery(agentContext, { foo: 'bar' }, { cacheKey: 'other' })
    await uncachedRepository.findSingleByQuery(agentContext, { foo: 'bar' }, { cacheKey: 'other' })
    expect(storageService.findByQuery).toHaveBeenCalledTimes(3)
  })
})
