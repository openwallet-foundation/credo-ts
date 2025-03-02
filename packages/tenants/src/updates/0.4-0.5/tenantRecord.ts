import type { BaseAgent } from '@credo-ts/core'

import { TenantRepository } from '../../repository'

/**
 * Migrates the {@link TenantRecord} to 0.5 compatible format. It fetches all tenant records from
 * storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - Re-save record to store new `label` tag
 */
export async function migrateTenantRecordToV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating tenant records to storage version 0.5')
  const tenantRepository = agent.dependencyManager.resolve(TenantRepository)

  agent.config.logger.debug('Fetching all tenant records from storage')
  const tenantRecords = await tenantRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${tenantRecords.length} tenant records to update.`)
  for (const tenantRecord of tenantRecords) {
    agent.config.logger.debug(`Migrating tenant record with id ${tenantRecord.id} to storage version 0.5`)

    // NOTE: Record only has change in tags, we need to re-save the record
    await tenantRepository.update(agent.context, tenantRecord)

    agent.config.logger.debug(`Successfully migrated tenant record with id ${tenantRecord.id} to storage version 0.5`)
  }
}
