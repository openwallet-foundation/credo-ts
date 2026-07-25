import { AgentContext, type Cache, CacheModuleConfig, type CacheOptions } from '@credo-ts/core'
import Redis, { type RedisOptions } from 'ioredis'

export type RedisCacheOptions = RedisOptions

/**
 * Redis Cache implementation of the {@link Cache} interface.
 *
 * Keys are namespaced by the `contextCorrelationId` of the agent context by default, and by
 * `global:` for entries using the `'global'` scope, making the cache safe to use across multiple
 * agent context instances. This means `global` is effectively a reserved context correlation id.
 */
export class RedisCache implements Cache {
  private readonly _client: Redis

  constructor(options: RedisCacheOptions | Redis = {}) {
    this._client = options instanceof Redis ? options : new Redis(options)
  }

  private async client() {
    try {
      await this._client.ping()
      return this._client
    } catch {
      await this._client.connect()
      return this._client
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
    const client = await this.client()
    const namespacedKey = this.getNamespacedKey(agentContext, key, options)
    const value = await client.get(namespacedKey)
    return this.deserialize<CacheValue>(value)
  }

  public async set<CacheValue>(
    agentContext: AgentContext,
    key: string,
    value: CacheValue,
    expiresInSeconds: number | undefined = this.getDefaultExpiryInSeconds(agentContext),
    options?: CacheOptions
  ): Promise<void> {
    const client = await this.client()
    const namespacedKey = this.getNamespacedKey(agentContext, key, options)
    const serializedValue = this.serialize(value)

    if (expiresInSeconds) {
      await client.set(namespacedKey, serializedValue, 'EX', expiresInSeconds)
    } else {
      await client.set(namespacedKey, serializedValue)
    }
  }

  public async remove(agentContext: AgentContext, key: string, options?: CacheOptions): Promise<void> {
    const client = await this.client()
    const namespacedKey = this.getNamespacedKey(agentContext, key, options)
    await client.del(namespacedKey)
  }

  /**
   * Removes all entries scoped to the context of the provided agent context. Entries in the
   * global scope are never removed by this method and are only reclaimed through their TTL or
   * an explicit `remove`.
   */
  public async destroy(agentContext: AgentContext) {
    const client = await this.client()
    let cursor = '0'

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${agentContext.contextCorrelationId}:*`,
        'COUNT',
        '100' // limit
      )

      cursor = nextCursor

      if (keys.length > 0) {
        await client.del(...keys)
      }
    } while (cursor !== '0')
  }

  // TODO: we should have a method to close the cache, so we can hook into the
  // shutdown method.
  public async disconnect() {
    await this._client.quit()
  }
}
