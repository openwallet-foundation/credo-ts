import type { AgentContext, BaseAgent, DependencyManager } from '@credo-ts/core'
import { DidCommCredentialExchangeRepository } from '@credo-ts/didcomm'
import {
  migrateIndyCredentialMetadataToAnonCredsMetadata,
  migrateIndyCredentialTypeToAnonCredsCredential,
} from '../updates/0.3.1-0.4/credentialExchangeRecord'
import type { AnonCredsMigrationProvider } from '../updates/AnonCredsMigrationProvider'

/**
 * Preserves exchange links when upgrading from Credo TS before v0.5.x; not needed once storage is at version 0.5.
 */
export class AnonCredsDidCommMigrationProvider implements AnonCredsMigrationProvider {
  public isAvailable(dependencyManager: DependencyManager): boolean {
    return dependencyManager.isRegistered(DidCommCredentialExchangeRepository, true)
  }

  public async migrateCredentialExchangeRecordsToV0_4(agent: BaseAgent): Promise<void> {
    const repository = agent.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const records = await repository.getAll(agent.context)
    agent.config.logger.debug(`Found a total of ${records.length} credential exchange records to update.`)
    for (const record of records) {
      migrateIndyCredentialTypeToAnonCredsCredential(agent, record)
      migrateIndyCredentialMetadataToAnonCredsMetadata(agent, record)
      await repository.update(agent.context, record)
    }
  }

  public async relinkCredentialExchangeRecord(
    agentContext: AgentContext,
    {
      legacyCredentialId,
      w3cCredentialRecordId,
      qualifiedRevocationRegistryId,
    }: Parameters<AnonCredsMigrationProvider['relinkCredentialExchangeRecord']>[1]
  ): Promise<void> {
    const repository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const [record] = await repository.findByQuery(agentContext, { credentialIds: [legacyCredentialId] })
    if (!record) return

    const index = record.credentials.findIndex((binding) => binding.credentialRecordId === legacyCredentialId)
    if (index === -1) return

    record.credentials[index] = {
      credentialRecordType: 'w3c',
      credentialRecordId: w3cCredentialRecordId,
    }
    if (qualifiedRevocationRegistryId) {
      record.setTags({ anonCredsRevocationRegistryId: qualifiedRevocationRegistryId })
    }
    await repository.update(agentContext, record)
  }
}
