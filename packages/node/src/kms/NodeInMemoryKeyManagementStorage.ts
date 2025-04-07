import type { AgentContext, Kms } from '@credo-ts/core'
import type { NodeKeyManagementStorage } from './NodeKeyManagementStorage'

export class NodeInMemoryKeyManagementStorage implements NodeKeyManagementStorage {
  #storage = new Map<string, Map<string, Kms.KmsJwkPrivate>>()

  public async get(agentContext: AgentContext, keyId: string) {
    return this.storageForContext(agentContext).get(keyId) ?? null
  }

  public has(agentContext: AgentContext, keyId: string) {
    return this.storageForContext(agentContext).has(keyId)
  }

  public set(agentContext: AgentContext, keyId: string, jwk: Kms.KmsJwkPrivate) {
    this.storageForContext(agentContext).set(keyId, jwk)
  }

  public delete(agentContext: AgentContext, keyId: string) {
    return this.storageForContext(agentContext).delete(keyId)
  }

  private storageForContext(agentContext: AgentContext) {
    let storage = this.#storage.get(agentContext.contextCorrelationId)

    if (!storage) {
      storage = new Map()
      this.#storage.set(agentContext.contextCorrelationId, storage)
    }

    return storage
  }
}
