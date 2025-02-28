import type { BaseAgent } from '../../../../agent/BaseAgent'
import type { StorageService } from '../../../StorageService'

import { InjectionSymbols } from '../../../../constants'
import { BaseRecord } from '../../../BaseRecord'

/**
 * removes the all cache records as used in 0.3.0, as they have been updated to use the new cache interface.
 */
export async function migrateCacheToV0_4<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Removing 0.3 cache records from storage')

  const storageService = agent.dependencyManager.resolve<StorageService<BaseRecord>>(InjectionSymbols.StorageService)

  agent.config.logger.debug('Fetching all cache records')
  const records = await storageService.getAll(agent.context, CacheRecord)

  for (const record of records) {
    agent.config.logger.debug(`Removing cache record with id ${record.id}`)
    await storageService.deleteById(agent.context, CacheRecord, record.id)
    agent.config.logger.debug(`Successfully removed cache record with id ${record.id}`)
  }
}

class CacheRecord extends BaseRecord {
  public static readonly type = 'CacheRecord'
  public readonly type = CacheRecord.type

  public getTags() {
    return this._tags
  }
}
