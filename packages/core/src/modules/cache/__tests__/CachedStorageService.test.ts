import { getAgentContext } from '../../../../tests/helpers'
import { TestRecord } from '../../../storage/__tests__/TestRecord'
import type { StorageService } from '../../../storage/StorageService'
import { CachedStorageService } from '../CachedStorageService'
import { CacheModuleConfig } from '../CacheModuleConfig'
import { InMemoryLruCache } from '../InMemoryLruCache'

class CachedTestRecord extends TestRecord {
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
})
