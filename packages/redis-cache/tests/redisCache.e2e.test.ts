import { type AddressInfo, createServer } from 'node:net'
import { CredoError } from '@credo-ts/core'
import Redis from 'ioredis'
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

  it('should get key "9" with global scope set by other agent', async () => {
    await expect(redisCache.set(agentContext, '9', 'a', undefined, { scope: 'global' })).resolves.toBeUndefined()

    await expect(redisCache.get(agentContextTwo, '9', { scope: 'global' })).resolves.toEqual('a')
    // Global and context scopes are disjoint
    await expect(redisCache.get(agentContext, '9')).resolves.toBeNull()

    await expect(redisCache.remove(agentContext, '9', { scope: 'global' })).resolves.toBeUndefined()
    await expect(redisCache.get(agentContextTwo, '9', { scope: 'global' })).resolves.toBeNull()
  })

  it('should not remove global keys when agent is destroyed', async () => {
    await expect(redisCache.set(agentContext, '10', 'a', undefined, { scope: 'global' })).resolves.toBeUndefined()

    await redisCache.destroy(agentContext)

    await expect(redisCache.get(agentContext, '10', { scope: 'global' })).resolves.toEqual('a')
    await expect(redisCache.remove(agentContext, '10', { scope: 'global' })).resolves.toBeUndefined()
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

  it('should reconnect after the client was disconnected', async () => {
    const cache = new RedisCache()
    await cache.disconnect()

    await cache.set(agentContext, 'reconnect', 'value')
    await expect(cache.get(agentContext, 'reconnect')).resolves.toStrictEqual('value')
    await cache.disconnect()
  })

  it('should not throw from get, set and remove when redis fails, and log a failed remove as an error', async () => {
    // Nothing listens on port 1, and without retries every connection attempt fails right away.
    const client = new Redis({ port: 1, lazyConnect: true, retryStrategy: () => null })
    // ioredis logs connection errors to the console when nothing listens for them.
    client.on('error', () => {})
    const failingCache = new RedisCache(client)

    await expect(failingCache.set(agentContext, 'unavailable', 'value')).resolves.toBeUndefined()
    await expect(failingCache.get(agentContext, 'unavailable')).resolves.toBeNull()
    const errorSpy = vi.spyOn(agentContext.config.logger, 'error')
    await expect(failingCache.remove(agentContext, 'unavailable')).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Error removing key 'unavailable'"), {
      error: new Error('Connection is closed.'),
    })
  })

  it('should give up on an operation after the operation timeout', async () => {
    // With its default retries, ioredis waits about 10 seconds before it gives up on an unreachable Redis.
    const unreachableCache = new RedisCache({ port: 1, operationTimeoutMs: 100 })
    const start = Date.now()

    await expect(unreachableCache.get(agentContext, 'unreachable')).resolves.toBeNull()
    await expect(unreachableCache.remove(agentContext, 'unreachable')).resolves.toBeUndefined()
    expect(Date.now() - start).toBeLessThan(1000)

    await unreachableCache.shutdown()
  })

  it('should skip redis for get and set during the cooldown after a timeout, but not for remove', async () => {
    // Accepts connections but never answers, like a Redis that hangs.
    const server = createServer(() => {})
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const { port } = server.address() as AddressInfo
    const hangingCache = new RedisCache({ port, operationTimeoutMs: 200, cooldownMs: 60_000 })

    await expect(hangingCache.get(agentContext, 'hanging')).resolves.toBeNull()

    const start = Date.now()
    await expect(hangingCache.get(agentContext, 'hanging')).resolves.toBeNull()
    await hangingCache.set(agentContext, 'hanging', 'value')
    expect(Date.now() - start).toBeLessThan(100)

    // `remove` still tries Redis, and gives up after the operation timeout.
    const errorSpy = vi.spyOn(agentContext.config.logger, 'error')
    await hangingCache.remove(agentContext, 'hanging')
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), {
      error: new CredoError('Redis cache operation did not complete within 200ms'),
    })

    await hangingCache.shutdown()
    server.close()
  })

  it('should skip redis for get and set during the cooldown when the commandTimeout of the client fails first', async () => {
    const server = createServer(() => {})
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const { port } = server.address() as AddressInfo
    const client = new Redis({ port, commandTimeout: 200 })
    const hangingCache = new RedisCache({ client, operationTimeoutMs: 5000, cooldownMs: 60_000 })

    await expect(hangingCache.get(agentContext, 'hanging')).resolves.toBeNull()

    const start = Date.now()
    await expect(hangingCache.get(agentContext, 'hanging')).resolves.toBeNull()
    await hangingCache.set(agentContext, 'hanging', 'value')
    expect(Date.now() - start).toBeLessThan(100)

    client.disconnect()
    server.close()
  })

  it('should skip redis for get and set while ioredis reconnects', async () => {
    // The first connection fails, after which ioredis waits a minute before it tries again.
    const reconnectingCache = new RedisCache({ port: 1, retryStrategy: () => 60_000, operationTimeoutMs: 5000 })
    // biome-ignore lint/complexity/useLiteralKeys: bracket access reads the private client
    await vi.waitFor(() => expect(reconnectingCache['_client'].status).toBe('reconnecting'))

    const start = Date.now()
    await expect(reconnectingCache.get(agentContext, 'reconnecting')).resolves.toBeNull()
    await reconnectingCache.set(agentContext, 'reconnecting', 'value')
    expect(Date.now() - start).toBeLessThan(100)

    await reconnectingCache.shutdown()
  })

  it('should round an expiry up to whole seconds, and not store an entry that has expired', async () => {
    await redisCache.set(agentContext, 'fraction', 'a', 1.5)
    await expect(redisCache.get(agentContext, 'fraction')).resolves.toEqual('a')

    await redisCache.set(agentContext, 'expired', 'a', -0.5)
    await expect(redisCache.get(agentContext, 'expired')).resolves.toBeNull()
  })

  it('should destroy only the entries of the context with glob characters in the key prefix and its id', async () => {
    const prefixedCache = new RedisCache({ keyPrefix: 'credo[test]:' })
    const globContext = getAgentContext({ contextCorrelationId: 'ab*' })
    const otherContext = getAgentContext({ contextCorrelationId: 'abc' })
    await prefixedCache.set(globContext, 'key', 'a')
    await prefixedCache.set(otherContext, 'key', 'a')

    await prefixedCache.destroy(globContext)

    await expect(prefixedCache.get(globContext, 'key')).resolves.toBeNull()
    await expect(prefixedCache.get(otherContext, 'key')).resolves.toEqual('a')

    await prefixedCache.destroy(otherContext)
    await prefixedCache.shutdown()
  })

  it('should close only a client it created on shutdown', async () => {
    const ownCache = new RedisCache()
    const sharedClient = new Redis()
    const sharedCache = new RedisCache({ client: sharedClient })

    await ownCache.shutdown()
    await sharedCache.shutdown()

    // biome-ignore lint/complexity/useLiteralKeys: bracket access reads the private client
    await vi.waitFor(() => expect(ownCache['_client'].status).toBe('end'))
    await expect(sharedClient.ping()).resolves.toEqual('PONG')
    await sharedClient.quit()
  })

  it('should not reopen the client after shutdown, and resolve a later disconnect', async () => {
    const cache = new RedisCache()
    await cache.set(agentContext, 'shutdown', 'value')
    await cache.shutdown()

    // biome-ignore lint/complexity/useLiteralKeys: bracket access reads the private client
    await vi.waitFor(() => expect(cache['_client'].status).toBe('end'))
    // Before the agent closed the cache, apps called `disconnect` themselves.
    await expect(cache.disconnect()).resolves.toBeUndefined()
    await expect(cache.remove(agentContext, 'shutdown')).resolves.toBeUndefined()
    // biome-ignore lint/complexity/useLiteralKeys: bracket access reads the private client
    expect(cache['_client'].status).toBe('end')
  })
})
