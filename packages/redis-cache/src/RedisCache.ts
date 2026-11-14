import { AgentContext, type Cache, CacheModuleConfig, type CacheOptions, CredoError } from '@credo-ts/core'
import Redis, { type RedisOptions } from 'ioredis'

export interface RedisCacheOptions extends RedisOptions {
  /**
   * The client to use, for example one the app shares with other code. The ioredis options are then ignored,
   * while `operationTimeoutMs` and `cooldownMs` still apply. The cache never closes the client.
   */
  client?: Redis

  /**
   * How long a cache operation may take before the cache gives up on it. This keeps an
   * unreachable Redis from holding up the agent: with its default options, ioredis takes about 10 seconds to
   * give up on a command. Unlike ioredis' `commandTimeout`, it only applies to the cache's own operations, so a
   * shared client keeps its own settings.
   *
   * @default 1000
   */
  operationTimeoutMs?: number

  /**
   * How long `get` and `set` skip Redis after an operation failed or timed out, so a Redis that doesn't answer slows down
   * one request rather than every one. They also skip it while ioredis reconnects. `remove` always tries Redis:
   * a skipped `get` or `set` only costs a cache miss, while a skipped `remove` leaves an outdated entry when Redis
   * was reachable after all.
   *
   * @default 5000
   */
  cooldownMs?: number
}

/**
 * Redis Cache implementation of the {@link Cache} interface.
 *
 * Keys are namespaced by the `contextCorrelationId` of the agent context by default, and by
 * `global:` for entries using the `'global'` scope, making the cache safe to use across multiple
 * agent context instances. This means `global` is effectively a reserved context correlation id.
 */
export class RedisCache implements Cache {
  private readonly _client: Redis
  private readonly ownsClient: boolean
  private readonly operationTimeoutMs: number
  private readonly cooldownMs: number
  private unavailableUntil = 0
  private isShutdown = false

  constructor(options: RedisCacheOptions | Redis = {}) {
    const {
      client,
      operationTimeoutMs = 1000,
      cooldownMs = 5000,
      ...redisOptions
    }: RedisCacheOptions = isRedisClient(options) ? { client: options } : options

    this.operationTimeoutMs = operationTimeoutMs
    this.cooldownMs = cooldownMs
    this.ownsClient = !client
    this._client = client ?? new Redis(redisOptions)

    // Failed operations are logged with the agent's logger. Without a listener, ioredis writes every
    // connection error to the console.
    if (this.ownsClient) this._client.on('error', () => {})
  }

  private async client() {
    // ioredis connects and reconnects by itself, except once the connection ended, e.g. after `disconnect`.
    // After `shutdown` it stays closed, so work that still runs while the agent shuts down can't reopen it.
    if (this._client.status === 'end' && !this.isShutdown) await this._client.connect()
    return this._client
  }

  private isUnavailable() {
    // While ioredis reconnects, a command waits until ioredis gives up on it.
    return this._client.status === 'reconnecting' || Date.now() < this.unavailableUntil
  }

  private async run<Result>(command: (client: Redis) => Promise<Result>): Promise<Result> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new CredoError(`Redis cache operation did not complete within ${this.operationTimeoutMs}ms`)),
        this.operationTimeoutMs
      )
    })

    try {
      return await Promise.race([this.client().then(command), timedOut])
    } catch (error) {
      // Any failure, as ioredis can give up first, e.g. with the `commandTimeout` of a client the app passed in.
      this.unavailableUntil = Date.now() + this.cooldownMs
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private getNamespacedKey(agentContext: AgentContext, key: string, options?: CacheOptions): string {
    if (options?.scope === 'global') {
      return `global:${key}`
    }

    return `${agentContext.contextCorrelationId}:${key}`
  }

  private serialize<CacheValue>(value: CacheValue): string {
    return JSON.stringify(value)
  }

  private deserialize<CacheValue>(value: string | null): CacheValue | null {
    return value === null ? value : (JSON.parse(value) as CacheValue)
  }

  private getDefaultExpiryInSeconds(agentContext: AgentContext) {
    try {
      return agentContext.resolve(CacheModuleConfig).defaultExpiryInSeconds
    } catch {
      return undefined
    }
  }

  public async get<CacheValue>(
    agentContext: AgentContext,
    key: string,
    options?: CacheOptions
  ): Promise<CacheValue | null> {
    if (this.isUnavailable()) return null

    try {
      const namespacedKey = this.getNamespacedKey(agentContext, key, options)
      const value = await this.run((client) => client.get(namespacedKey))
      return this.deserialize<CacheValue>(value)
    } catch (error) {
      agentContext.config.logger.warn(`Error getting key '${key}' from the redis cache. Treating it as not cached.`, {
        error,
      })
      return null
    }
  }

  public async set<CacheValue>(
    agentContext: AgentContext,
    key: string,
    value: CacheValue,
    expiresInSeconds: number | undefined = this.getDefaultExpiryInSeconds(agentContext),
    options?: CacheOptions
  ): Promise<void> {
    // Redis only takes whole seconds. An entry that has already expired is never served, so it isn't stored.
    const expiry = expiresInSeconds ? Math.ceil(expiresInSeconds) : undefined
    if ((expiry !== undefined && expiry <= 0) || this.isUnavailable()) return

    try {
      const namespacedKey = this.getNamespacedKey(agentContext, key, options)
      const serializedValue = this.serialize(value)

      await this.run((client) =>
        expiry ? client.set(namespacedKey, serializedValue, 'EX', expiry) : client.set(namespacedKey, serializedValue)
      )
    } catch (error) {
      agentContext.config.logger.warn(`Error setting key '${key}' in the redis cache. The value is not cached.`, {
        error,
      })
    }
  }

  public async remove(agentContext: AgentContext, key: string, options?: CacheOptions): Promise<void> {
    try {
      const namespacedKey = this.getNamespacedKey(agentContext, key, options)
      await this.run((client) => client.del(namespacedKey))
    } catch (error) {
      agentContext.config.logger.error(
        `Error removing key '${key}' from the redis cache. It can be served outdated until it expires.`,
        { error }
      )
    }
  }

  /**
   * Removes all entries scoped to the context of the provided agent context. Entries in the
   * global scope are never removed by this method and are only reclaimed through their TTL or
   * an explicit `remove`. It scans every key in the Redis database, so give the cache a database
   * of its own when Redis holds a lot of other keys.
   */
  public async destroy(agentContext: AgentContext) {
    // ioredis adds `keyPrefix` to the keys of DEL, but not to the pattern of SCAN or the keys it returns.
    const keyPrefix = this._client.options.keyPrefix ?? ''
    const pattern = `${escapeGlobPattern(keyPrefix + agentContext.contextCorrelationId)}:*`
    let cursor = '0'

    do {
      const [nextCursor, keys] = await this.run((client) => client.scan(cursor, 'MATCH', pattern, 'COUNT', '1000'))
      cursor = nextCursor

      if (keys.length > 0) {
        await this.run((client) => client.del(...keys.map((key) => key.slice(keyPrefix.length))))
      }
    } while (cursor !== '0')
  }

  /** Closes the client if the cache created it. A client passed in belongs to the app, which closes it. */
  public async shutdown() {
    this.isShutdown = true
    // Unlike `quit`, this doesn't wait on Redis, so an unreachable Redis can't hold up the shutdown.
    if (this.ownsClient) this._client.disconnect()
  }

  public async disconnect() {
    // `shutdown` already closed a client the cache created, and `quit` fails on a closed client.
    if (this.isShutdown && this.ownsClient) return

    // `quit` resolves before the connection has closed, and `client()` only reconnects a closed one.
    const ended = new Promise((resolve) => this._client.once('end', resolve))
    await this._client.quit()
    await ended
  }
}

// Checks the shape, as `instanceof Redis` fails for a client from another copy of ioredis.
function isRedisClient(options: RedisCacheOptions | Redis): options is Redis {
  return typeof (options as Redis).sendCommand === 'function'
}

function escapeGlobPattern(value: string) {
  return value.replace(/[*?[\]\\]/g, '\\$&')
}
