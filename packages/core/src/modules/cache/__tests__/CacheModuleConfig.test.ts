import { CacheModuleConfig } from '../CacheModuleConfig'
import { InMemoryLruCache } from '../InMemoryLruCache'

describe('CacheModuleConfig', () => {
  test('sets values', () => {
    const cache = new InMemoryLruCache({ limit: 1 })

    const config = new CacheModuleConfig({
      cache,
    })

    expect(config.cache).toEqual(cache)
  })
})
