import type { AgentContext } from '../../agent/context'

export interface CacheOptions {
  /**
   * The scope of the cache entry:
   *
   * - `'context'` (default): the entry is isolated to the `contextCorrelationId` of the provided
   *   agent context. Implementations MUST default to this scope.
   * - `'global'`: the entry is shared across all agent contexts. Only use this for public,
   *   non-context-specific data (e.g. CRLs, DID documents of public DID methods, ledger objects).
   *
   * @default 'context'
   */
  scope?: 'context' | 'global'
}

export interface Cache {
  get<CacheValue>(agentContext: AgentContext, key: string, options?: CacheOptions): Promise<CacheValue | null>
  set<CacheValue>(
    agentContext: AgentContext,
    key: string,
    value: CacheValue,
    expiresInSeconds?: number,
    options?: CacheOptions
  ): Promise<void>
  remove(agentContext: AgentContext, key: string, options?: CacheOptions): Promise<void>
}
