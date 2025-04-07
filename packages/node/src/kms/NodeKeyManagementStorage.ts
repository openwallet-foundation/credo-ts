import type { AgentContext, CanBePromise, Kms } from '@credo-ts/core'

export interface NodeKeyManagementStorage {
  get(agentContext: AgentContext, keyId: string): CanBePromise<Kms.KmsJwkPrivate | null>
  has(agentContext: AgentContext, keyId: string): CanBePromise<boolean>

  // TODO: can also require `kid`
  set(agentContext: AgentContext, keyId: string, jwk: Kms.KmsJwkPrivate): CanBePromise<void>

  /**
   * @returns whether the item existed and was removed
   */
  delete(agentContext: AgentContext, keyId: string): CanBePromise<boolean>
}
