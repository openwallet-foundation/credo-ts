import type { AgentContext } from '../../agent/context'

export interface Cache {
  get<CacheValue>(agentContext: AgentContext, key: string): Promise<CacheValue | null>
  set<CacheValue>(agentContext: AgentContext, key: string, value: CacheValue, expiresInSeconds?: number): Promise<void>
  remove(agentContext: AgentContext, key: string): Promise<void>
}
