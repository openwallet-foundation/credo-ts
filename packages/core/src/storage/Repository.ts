import type { AgentContext } from '../agent'
import type { EventEmitter } from '../agent/EventEmitter'
import type { BaseRecord } from './BaseRecord'
import type { RecordDeletedEvent, RecordSavedEvent, RecordUpdatedEvent } from './RepositoryEvents'
import type { BaseRecordConstructor, Query, QueryOptions, StorageService } from './StorageService'

import { RecordDuplicateError, RecordNotFoundError } from '../error'
import { CacheModuleConfig } from '../modules/cache/CacheModuleConfig'
import { CachedStorageService } from '../modules/cache/CachedStorageService'
import { JsonTransformer } from '../utils'
import { RepositoryEventTypes } from './RepositoryEvents'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export class Repository<T extends BaseRecord<any, any, any>> {
  private storageService: StorageService<T>
  private recordClass: BaseRecordConstructor<T>
  private eventEmitter: EventEmitter

  public constructor(
    recordClass: BaseRecordConstructor<T>,
    storageService: StorageService<T>,
    eventEmitter: EventEmitter
  ) {
    this.recordClass = recordClass
    this.storageService = storageService
    this.eventEmitter = eventEmitter
  }

  private getStorageService(agentContext: AgentContext): StorageService<T> {
    try {
      if (agentContext.dependencyManager.isRegistered(CachedStorageService, true)) {
        return agentContext.resolve(CachedStorageService<T>)
      }

      return this.storageService
    } catch {
      return this.storageService
    }
  }

  /** @inheritDoc {StorageService#save} */
  public async save(agentContext: AgentContext, record: T): Promise<void> {
    await this.getStorageService(agentContext).save(agentContext, record)

    this.eventEmitter.emit<RecordSavedEvent<T>>(agentContext, {
      type: RepositoryEventTypes.RecordSaved,
      payload: {
        // Record in event should be static
        record: record.clone(),
      },
    })
  }

  /** @inheritDoc {StorageService#update} */
  public async update(agentContext: AgentContext, record: T): Promise<void> {
    await this.getStorageService(agentContext).update(agentContext, record)

    this.eventEmitter.emit<RecordUpdatedEvent<T>>(agentContext, {
      type: RepositoryEventTypes.RecordUpdated,
      payload: {
        // Record in event should be static
        record: record.clone(),
      },
    })
  }

  /** @inheritDoc {StorageService#delete} */
  public async delete(agentContext: AgentContext, record: T): Promise<void> {
    await this.getStorageService(agentContext).delete(agentContext, record)

    this.eventEmitter.emit<RecordDeletedEvent<T>>(agentContext, {
      type: RepositoryEventTypes.RecordDeleted,
      payload: {
        // Record in event should be static
        record: record.clone(),
      },
    })
  }

  /**
   * Delete record by id. Throws {RecordNotFoundError} if no record is found
   * @param id the id of the record to delete
   * @returns
   */
  public async deleteById(agentContext: AgentContext, id: string): Promise<void> {
    await this.getStorageService(agentContext).deleteById(agentContext, this.recordClass, id)

    this.eventEmitter.emit<RecordDeletedEvent<T>>(agentContext, {
      type: RepositoryEventTypes.RecordDeleted,
      payload: {
        record: { id, type: this.recordClass.type },
      },
    })
  }

  /** @inheritDoc {StorageService#getById} */
  public async getById(agentContext: AgentContext, id: string): Promise<T> {
    return this.getStorageService(agentContext).getById(agentContext, this.recordClass, id)
  }

  /**
   * Find record by id. Returns null if no record is found
   * @param id the id of the record to retrieve
   * @returns
   */
  public async findById(agentContext: AgentContext, id: string): Promise<T | null> {
    try {
      return await this.getStorageService(agentContext).getById(agentContext, this.recordClass, id)
    } catch (error) {
      if (error instanceof RecordNotFoundError) return null

      throw error
    }
  }

  /** @inheritDoc {StorageService#getAll} */
  public async getAll(agentContext: AgentContext): Promise<T[]> {
    return this.getStorageService(agentContext).getAll(agentContext, this.recordClass)
  }

  /** @inheritDoc {StorageService#findByQuery} */
  public async findByQuery(agentContext: AgentContext, query: Query<T>, queryOptions?: QueryOptions): Promise<T[]> {
    return this.getStorageService(agentContext).findByQuery(agentContext, this.recordClass, query, queryOptions)
  }

  /**
   * Find a single record by query. Returns null if not found.
   * @param query the query
   * @param cacheKey optional cache key to use for caching. By default query results are not cached, but if a cache key is provided
   *                  as well as the record allows caching and the agent has a cached storage service enabled it will use the cache.
   * @returns the record, or null if not found
   * @throws {RecordDuplicateError} if multiple records are found for the given query
   */
  public async findSingleByQuery(
    agentContext: AgentContext,
    query: Query<T>,
    { cacheKey }: { cacheKey?: string } = {}
  ): Promise<T | null> {
    const cache = agentContext.resolve(CacheModuleConfig)
    const useCacheStorage = cache.useCachedStorageService ?? false

    if (useCacheStorage && cacheKey) {
      const recordId = (await cache?.cache.get<string>(agentContext, cacheKey)) ?? null
      if (recordId !== null) {
        const recordJson = await cache?.cache.get<T>(agentContext, recordId)
        if (recordJson) return JsonTransformer.fromJSON(recordJson, this.recordClass)
      }
    }

    const records = await this.findByQuery(agentContext, query)
    if (records.length > 1) {
      throw new RecordDuplicateError(`Multiple records found for given query '${JSON.stringify(query)}'`, {
        recordType: this.recordClass.type,
      })
    }

    if (records.length < 1) {
      return null
    }

    if (useCacheStorage && cacheKey) {
      await cache?.cache.set(agentContext, cacheKey, records[0].id)
      await cache?.cache.set(agentContext, records[0].id, records[0].toJSON())
    }

    return records[0]
  }

  /**
   * Find a single record by query. Throws if not found
   * @param query the query
   * @returns the record
   * @throws {RecordDuplicateError} if multiple records are found for the given query
   * @throws {RecordNotFoundError} if no record is found for the given query
   */
  public async getSingleByQuery(agentContext: AgentContext, query: Query<T>): Promise<T> {
    const record = await this.findSingleByQuery(agentContext, query)

    if (!record) {
      throw new RecordNotFoundError(`No record found for given query '${JSON.stringify(query)}'`, {
        recordType: this.recordClass.type,
      })
    }

    return record
  }
}
