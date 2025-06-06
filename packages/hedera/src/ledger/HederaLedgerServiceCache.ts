import { AgentContext, CacheModuleConfig, CredoError } from '@credo-ts/core'

export interface CredoCache {
  get<CacheValue>(agentContext: AgentContext, key: string): Promise<CacheValue | null>
  set<CacheValue>(agentContext: AgentContext, key: string, value: CacheValue, expiresInSeconds?: number): Promise<void>
  remove(agentContext: AgentContext, key: string): Promise<void>
}

interface SdkCache {
  get<CacheValue>(key: string): Promise<CacheValue | null>
  set<CacheValue>(key: string, value: CacheValue, expiresInSeconds?: number): Promise<void>
  remove(key: string): Promise<void>
}

export class HederaLedgerServiceCache implements SdkCache {
  private readonly credoCache: CredoCache

  constructor(private readonly agentContext: AgentContext) {
    this.credoCache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
  }

  async get<CacheValue>(key: string): Promise<CacheValue | null> {
    if (!this.credoCache) {
      throw new CredoError('Error initializing cache')
    }
    return await this.credoCache.get(this.agentContext, key)
  }

  async set<CacheValue>(key: string, value: CacheValue, _expiresInSeconds?: number): Promise<void> {
    if (!this.credoCache) {
      throw new CredoError('Error initializing cache')
    }
    await this.credoCache.set(this.agentContext, key, value)
  }

  async remove(key: string): Promise<void> {
    if (!this.credoCache) {
      throw new CredoError('Error initializing cache')
    }
    await this.credoCache.remove(this.agentContext, key)
  }
}
