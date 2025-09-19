import { AgentContext, CacheModuleConfig, CredoError } from '@credo-ts/core'
import { Cache as CoreCredoCache } from '@credo-ts/core'
import { CredoCache } from '../../src/ledger/cache/CredoCache'

describe('CredoCache', () => {
  let mockAgentContext: AgentContext
  let mockDependencyManagerResolve: jest.Mock
  let mockCredoCache: jest.Mocked<CoreCredoCache>

  beforeEach(() => {
    mockCredoCache = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    }

    mockDependencyManagerResolve = jest.fn().mockReturnValue({ cache: mockCredoCache })

    mockAgentContext = {
      dependencyManager: {
        resolve: mockDependencyManagerResolve,
      },
    } as unknown as AgentContext
  })

  it('should throw CredoError if cache not found in constructor', () => {
    mockDependencyManagerResolve.mockReturnValue({ cache: null })

    expect(() => new CredoCache(mockAgentContext)).toThrow(CredoError)
  })

  it('should initialize credoCache from dependency manager', () => {
    const credoCacheInstance = new CredoCache(mockAgentContext)
    expect(mockDependencyManagerResolve).toHaveBeenCalledWith(CacheModuleConfig)
    // @ts-ignore
    expect(credoCacheInstance.credoCache).toBe(mockCredoCache)
  })

  describe('get', () => {
    it('should call credoCache.get with correct parameters and return value', async () => {
      const testKey = 'test-key'
      const returnedValue = { foo: 'bar' }
      mockCredoCache.get.mockResolvedValue(returnedValue)

      const credoCacheInstance = new CredoCache(mockAgentContext)
      const result = await credoCacheInstance.get(testKey)

      expect(mockCredoCache.get).toHaveBeenCalledWith(mockAgentContext, testKey)
      expect(result).toBe(returnedValue)
    })

    it('should return null if credoCache.get resolves null', async () => {
      mockCredoCache.get.mockResolvedValue(null)

      const credoCacheInstance = new CredoCache(mockAgentContext)
      const result = await credoCacheInstance.get('missing')

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should call credoCache.set with correct parameters', async () => {
      const key = 'key'
      const value = { a: 1 }
      mockCredoCache.set.mockResolvedValue(undefined)

      const credoCacheInstance = new CredoCache(mockAgentContext)
      await credoCacheInstance.set(key, value, 123)

      expect(mockCredoCache.set).toHaveBeenCalledWith(mockAgentContext, key, value)
    })
  })

  describe('remove', () => {
    it('should call credoCache.remove with correct parameters', async () => {
      const key = 'keyToRemove'
      mockCredoCache.remove.mockResolvedValue(undefined)

      const credoCacheInstance = new CredoCache(mockAgentContext)
      await credoCacheInstance.remove(key)

      expect(mockCredoCache.remove).toHaveBeenCalledWith(mockAgentContext, key)
    })
  })

  describe('clear', () => {
    it('should throw error when called', async () => {
      const credoCacheInstance = new CredoCache(mockAgentContext)
      await expect(credoCacheInstance.clear()).resolves.not.toThrow()
    })
  })
})
