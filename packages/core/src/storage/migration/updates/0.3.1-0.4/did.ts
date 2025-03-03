import type { BaseAgent } from '../../../../agent/BaseAgent'
import type { DidRecord } from '../../../../modules/dids'

import { DidDocumentRole, DidRepository } from '../../../../modules/dids'

/**
 * Migrates the {@link DidRecord} to 0.4 compatible format. It fetches all did records from storage
 * with method sov and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateSovDidToIndyDid}
 */
export async function migrateDidRecordToV0_4<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating did records to storage version 0.4')
  const didRepository = agent.dependencyManager.resolve(DidRepository)

  agent.config.logger.debug('Fetching all did records with did method did:sov from storage')
  const allSovDids = await didRepository.findByQuery(agent.context, {
    method: 'sov',
    role: DidDocumentRole.Created,
  })

  agent.config.logger.debug(`Found a total of ${allSovDids.length} did:sov did records to update.`)
  for (const sovDidRecord of allSovDids) {
    agent.config.logger.debug(`Migrating did:sov did record with id ${sovDidRecord.id} to storage version 0.4`)

    const oldDid = sovDidRecord.did
    migrateSovDidToIndyDid(agent, sovDidRecord)

    // Save updated did record
    await didRepository.update(agent.context, sovDidRecord)

    agent.config.logger.debug(
      `Successfully migrated did:sov did record with old did ${oldDid} to new did ${sovDidRecord.did} for storage version 0.4`
    )
  }
}

export function migrateSovDidToIndyDid<Agent extends BaseAgent>(agent: Agent, didRecord: DidRecord) {
  agent.config.logger.debug(
    `Migrating did record with id ${didRecord.id} and did ${didRecord.did} to indy did for version 0.4`
  )

  const qualifiedIndyDid = didRecord.getTag('qualifiedIndyDid') as string

  didRecord.did = qualifiedIndyDid

  // Unset qualifiedIndyDid tag
  didRecord.setTag('qualifiedIndyDid', undefined)
}
