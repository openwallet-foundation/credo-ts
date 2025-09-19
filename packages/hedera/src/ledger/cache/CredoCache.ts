import { AgentContext, CacheModuleConfig, CredoError } from '@credo-ts/core'
import { Cache as CoreCredoCache } from '@credo-ts/core'
import { Cache } from '@hiero-did-sdk/core'

export class CredoCache implements Cache {
  private readonly credoCache: CoreCredoCache

  constructor(private readonly agentContext: AgentContext) {
    this.credoCache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
    if (!this.credoCache) {
      throw new CredoError('Failed to initialize cache: Credo cache instance is not found in dependency manager')
    }
  }

  async get<CacheValue>(key: string): Promise<CacheValue | null> {
    return await this.credoCache.get(this.agentContext, key)
  }

  async set<CacheValue>(key: string, value: CacheValue, _expiresInSeconds?: number): Promise<void> {
    await this.credoCache.set(this.agentContext, key, value)
  }

  async remove(key: string): Promise<void> {
    await this.credoCache.remove(this.agentContext, key)
  }

  async clear(): Promise<void> {
    // no-op
  }
}
