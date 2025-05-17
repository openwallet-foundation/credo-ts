import { getAgentContext } from '../../core/tests/helpers'
import { RedisCache } from '../src'

describe('RedisCache', () => {
  const agentContext = getAgentContext()
  const agentContextTwo = getAgentContext({ contextCorrelationId: 'abba' })
  let redisCache: RedisCache

  beforeAll(async () => {
    redisCache = new RedisCache()
  })

  afterAll(async () => {
    await redisCache.destroy(agentContext)
    await redisCache.disconnect()
  })

  it('should initialize the redis cache', () => {
    expect(redisCache).toBeDefined()
  })

  it('should set key "1" and value "one"', async () => {
    await expect(redisCache.set(agentContext, '1', 'one')).resolves.toBeUndefined()
  })

  it('should get key "2" and value "two"', async () => {
    await expect(redisCache.set(agentContext, '2', 'two')).resolves.toBeUndefined()
    await expect(redisCache.get(agentContext, '2')).resolves.toStrictEqual('two')
  })

  it('should get key "3" and value "{ a: "b" }"', async () => {
    await expect(redisCache.set(agentContext, '3', { a: 'b' })).resolves.toBeUndefined()
    await expect(redisCache.get(agentContext, '3')).resolves.toEqual({ a: 'b' })
  })

  it('should set key "4" and delete', async () => {
    await expect(redisCache.set(agentContext, '4', 'a')).resolves.toBeUndefined()
    await expect(redisCache.remove(agentContext, '4')).resolves.toBeUndefined()
    await expect(redisCache.get(agentContext, '4')).resolves.toBeNull()
  })

  it('should set key "5" and delete after ttl', async () => {
    await expect(redisCache.set(agentContext, '5', 'a', 2)).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 2100))
    await expect(redisCache.get(agentContext, '5')).resolves.toBeNull()
  })

  it('should not get key "6" set by other agent', async () => {
    await expect(redisCache.set(agentContext, '6', 'a')).resolves.toBeUndefined()

    await expect(redisCache.get(agentContextTwo, '6')).resolves.toBeNull()
  })

  it('should not remove all keys when agent is destoryed', async () => {
    await expect(redisCache.set(agentContext, '7', 'a')).resolves.toBeUndefined()
    await expect(redisCache.set(agentContext, '8', 'a')).resolves.toBeUndefined()

    await expect(redisCache.set(agentContextTwo, '7', 'a')).resolves.toBeUndefined()
    await expect(redisCache.set(agentContextTwo, '8', 'a')).resolves.toBeUndefined()

    await redisCache.destroy(agentContext)

    await expect(redisCache.get(agentContext, '7')).resolves.toBeNull()
    await expect(redisCache.get(agentContext, '8')).resolves.toBeNull()

    await expect(redisCache.get(agentContextTwo, '7')).resolves.toEqual('a')
    await expect(redisCache.get(agentContextTwo, '8')).resolves.toEqual('a')

    await redisCache.destroy(agentContextTwo)

    await expect(redisCache.get(agentContextTwo, '7')).resolves.toBeNull()
    await expect(redisCache.get(agentContextTwo, '8')).resolves.toBeNull()
  })
})
