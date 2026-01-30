import type { BaseAgent } from '../../../../agent/BaseAgent'

import { DidRepository } from '../../../../modules/dids'
import { uuid } from '../../../../utils/uuid'

/**
 * Migrates the {@link DidRecord} to 0.3 compatible format. It fetches all records from storage
 * and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link extractDidAsSeparateProperty}
 */
export async function migrateDidRecordToV0_3_1<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating did records to storage version 0.3.1')
  const didRepository = agent.dependencyManager.resolve(DidRepository)

  agent.config.logger.debug('Fetching all did records from storage')
  const allDids = await didRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${allDids.length} did records to update.`)
    for (const didRecord of allDids) {
        agent.config.logger.debug(`Migrating did record with id ${didRecord.id} to storage version 0.3.1`);

        // Save old DID or ID for reference/deletion
        const oldId = didRecord.id;

        // Generate new storage ID
        const newId = uuid();

        agent.config.logger.debug(`Updating id ${oldId} to ${newId} for did record`);

        // Preserve the actual DID in didRecord.did
        if (!didRecord.did) {
            didRecord.did = oldId; // fallback if didRecord.did was empty
        }

        didRecord.id = newId;

        // Save new did record
        await didRepository.save(agent.context, didRecord);

        // Delete old did record
        await didRepository.deleteById(agent.context, oldId);

        if (!didRecord.did.startsWith('did:')) {
            throw new Error(`Invalid DID after migration: ${didRecord.did}`);
        }

        agent.config.logger.debug(`Successfully migrated did record with old id ${oldId} to new id ${newId} to storage version 0.3.1`);
    }
}
