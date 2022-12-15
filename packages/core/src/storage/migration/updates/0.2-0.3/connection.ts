import type { BaseAgent } from '../../../../agent/BaseAgent'
import type { ConnectionRecord } from '../../../../modules/connections'

import { ConnectionType, ConnectionRepository } from '../../../../modules/connections'
import { MediationRepository } from '../../../../modules/routing'

/**
 * Migrate the {@link ConnectionRecord} to a 0.3 compatible format.
 *
 * @param agent
 */
export async function migrateConnectionRecordToV0_3<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating connection records to storage version 0.3')
  const connectionRepository = agent.dependencyManager.resolve(ConnectionRepository)
  const mediationRepository = agent.dependencyManager.resolve(MediationRepository)

  agent.config.logger.debug('Fetching all connection records from storage')
  const allConnections = await connectionRepository.getAll(agent.context)
  agent.config.logger.debug(`Found a total of ${allConnections.length} connection records to update`)

  agent.config.logger.debug('Fetching all mediation records from storage')
  const allMediators = await mediationRepository.getAll(agent.context)
  agent.config.logger.debug(`Found a total of ${allMediators.length} mediation records`)

  const mediatorConnectionIds = allMediators.map((mediator) => mediator.connectionId)

  for (const connectionRecord of allConnections) {
    agent.config.logger.debug(`Migrating connection record with id ${connectionRecord.id} to storage version 0.3`)

    if (mediatorConnectionIds.includes(connectionRecord.id)) {
      await migrateConnectionRecordMediatorTags(agent, connectionRecord)
    }

    await connectionRepository.update(agent.context, connectionRecord)

    agent.config.logger.debug(
      `Successfully migrated connection record with id ${connectionRecord.id} to storage version 0.3`
    )
  }
}

/**
 *
 * @param agent
 * @param connectionRecord
 */
export async function migrateConnectionRecordMediatorTags<Agent extends BaseAgent>(
  agent: Agent,
  connectionRecord: ConnectionRecord
) {
  agent.config.logger.debug(
    `Migrating internal connection record ${connectionRecord.id} to storage version 0.3 with mediator tags`
  )

  const connectionTypeTags = (connectionRecord.getTag('connectionType') || []) as [string]
  connectionRecord.setTag('connectionType', [...connectionTypeTags, ConnectionType.Mediator])

  agent.config.logger.debug(
    `Successfully migrated internal connection record ${connectionRecord.id} to storage version 0.3 with mediator tags`
  )
}
