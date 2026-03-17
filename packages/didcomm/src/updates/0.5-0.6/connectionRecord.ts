import type { BaseAgent } from '@credo-ts/core'

import { DidCommConnectionRepository } from '../../modules'

/**
 * Migrates the {@link DidCommCredentialExchangeRecord} to 0.5 compatible format. It fetches all credential exchange records from
 *  storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateRole}
 */
export async function migrateConnectionRecordToV0_6<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating DIDComm connection records to storage version 0.6')
  const connectionsRepository = agent.dependencyManager.resolve(DidCommConnectionRepository)

  agent.config.logger.debug('Fetching all credential records from storage')
  const connectionRecords = await connectionsRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${connectionRecords.length} DIDComm connection records to update.`)
  for (const connectionRecord of connectionRecords) {
    agent.config.logger.debug(
      `Migrating DIDComm connection record with id ${connectionRecord.id} to storage version 0.6`
    )

    // Set new tags based on record contents
    connectionRecord.setTag('alias', connectionRecord.alias)
    connectionRecord.setTag('theirLabel', connectionRecord.theirLabel)

    // Save updated record
    await connectionsRepository.update(agent.context, connectionRecord)

    agent.config.logger.debug(
      `Successfully migrated DIDComm connection record with id ${connectionRecord.id} to storage version 0.6`
    )
  }
}
