import type {
  AgentContext,
  BaseRecord,
  BaseRecordConstructor,
  Query,
  QueryOptions,
  StorageService,
} from '@credo-ts/core'
import { injectable, JsonTransformer, RecordDuplicateError, RecordNotFoundError } from '@credo-ts/core'
import { Scan, Session } from '@openwallet-foundation/askar-shared'

import { AskarStoreManager } from '../AskarStoreManager'
import { AskarError } from '../error'
import { AskarErrorCode, isAskarError } from '../utils/askarError'
import { askarQueryFromSearchQuery, recordToInstance, transformFromRecordTagValues } from './utils'

@injectable()
export class AskarStorageService<T extends BaseRecord> implements StorageService<T> {
  public constructor(private askarStoreManager: AskarStoreManager) {}

  private withSession<Return>(agentContext: AgentContext, callback: (session: Session) => Return) {
    return this.askarStoreManager.withSession(agentContext, callback)
  }

  /** @inheritDoc */
  public async save(agentContext: AgentContext, record: T) {
    record.updatedAt = new Date()

    const value = JsonTransformer.serialize(record)
    const tags = transformFromRecordTagValues(record.getTags()) as Record<string, string>

    try {
      await this.withSession(agentContext, (session) =>
        session.insert({ category: record.type, name: record.id, value, tags })
      )
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new RecordDuplicateError(`Record with id ${record.id} already exists`, { recordType: record.type })
      }

      throw new AskarError('Error saving record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async update(agentContext: AgentContext, record: T): Promise<void> {
    record.updatedAt = new Date()

    const value = JsonTransformer.serialize(record)
    const tags = transformFromRecordTagValues(record.getTags()) as Record<string, string>

    try {
      await this.withSession(agentContext, (session) =>
        session.replace({ category: record.type, name: record.id, value, tags })
      )
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.NotFound)) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: record.type,
          cause: error,
        })
      }

      throw new AskarError('Error updating record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async delete(agentContext: AgentContext, record: T) {
    try {
      await this.withSession(agentContext, (session) => session.remove({ category: record.type, name: record.id }))
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.NotFound)) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: record.type,
          cause: error,
        })
      }
      throw new AskarError('Error deleting record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    try {
      await this.withSession(agentContext, (session) => session.remove({ category: recordClass.type, name: id }))
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.NotFound)) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
          cause: error,
        })
      }
      throw new AskarError('Error deleting record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async getById(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    try {
      const record = await this.withSession(agentContext, (session) =>
        session.fetch({ category: recordClass.type, name: id })
      )
      if (!record) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
        })
      }
      return recordToInstance(record, recordClass)
    } catch (error) {
      if (error instanceof RecordNotFoundError) throw error
      throw new AskarError(`Error getting record ${recordClass.name}`, { cause: error })
    }
  }

  /** @inheritDoc */
  public async getAll(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    const records = await this.withSession(agentContext, (session) => session.fetchAll({ category: recordClass.type }))

    const instances = []
    for (const record of records) {
      instances.push(recordToInstance(record, recordClass))
    }
    return instances
  }

  /** @inheritDoc */
  public async findByQuery(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    query: Query<T>,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    const askarQuery = askarQueryFromSearchQuery(query)

    const { store, profile } = await this.askarStoreManager.getInitializedStoreWithProfile(agentContext)
    const scan = new Scan({
      category: recordClass.type,
      store,
      tagFilter: askarQuery,
      profile,
      offset: queryOptions?.offset,
      limit: queryOptions?.limit,
    })

    const instances = []
    try {
      const records = await scan.fetchAll()
      for (const record of records) {
        instances.push(recordToInstance(record, recordClass))
      }
      return instances
    } catch (error) {
      throw new AskarError(`Error executing query. ${error.message}`, { cause: error })
    }
  }
}
