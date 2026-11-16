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

/**
 * A cache is optional, so it must not fail the flow that uses it. When the cache can't be reached, `get`
 * returns `null`, and `set` and `remove` do nothing. A failed `remove` leaves an outdated entry until it
 * expires, so log it as an error.
 *
 * Values must survive JSON serialization, since a cache may store them as JSON: a `Uint8Array`,
 * `Date` or class instance comes back as a plain object.
 */
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

  /** Called when the agent shuts down, for example to close a connection the cache opened. */
  shutdown?(agentContext: AgentContext): Promise<void>
}
