import type { AgentContext, BaseAgent, DependencyManager } from '@credo-ts/core'

export interface AnonCredsMigrationProvider {
  isAvailable(dependencyManager: DependencyManager): boolean
  migrateCredentialExchangeRecordsToV0_4(agent: BaseAgent): Promise<void>
  relinkCredentialExchangeRecord(
    agentContext: AgentContext,
    options: {
      legacyCredentialId: string
      w3cCredentialRecordId: string
      qualifiedRevocationRegistryId?: string
    }
  ): Promise<void>
}
