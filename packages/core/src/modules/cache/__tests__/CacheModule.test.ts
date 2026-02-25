import type { MockedClassConstructor } from '../../../../../../tests/types'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { CacheModule } from '../CacheModule'
import { CacheModuleConfig } from '../CacheModuleConfig'
import { InMemoryLruCache } from '../InMemoryLruCache'
import { SingleContextStorageLruCache } from '../singleContextLruCache'
import { SingleContextLruCacheRepository } from '../singleContextLruCache/SingleContextLruCacheRepository'

vi.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as MockedClassConstructor<typeof DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('CacheModule', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('registers dependencies on the dependency manager', () => {
    const cacheModule = new CacheModule({
      cache: new InMemoryLruCache({ limit: 1 }),
    })
    cacheModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(CacheModuleConfig, cacheModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(0)
  })

  test('registers cache repository on the dependency manager if the SingleContextStorageLruCache is used', () => {
    const cacheModule = new CacheModule({
      cache: new SingleContextStorageLruCache({ limit: 1 }),
    })
    cacheModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(CacheModuleConfig, cacheModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SingleContextLruCacheRepository)
  })
})
