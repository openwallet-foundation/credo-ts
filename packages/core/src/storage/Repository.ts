import type { EventEmitter } from '../agent/EventEmitter'
import type { BaseRecord } from './BaseRecord'
import type { RecordSavedEvent, RecordUpdatedEvent, RecordDeletedEvent } from './RepositoryEvents'
import type { BaseRecordConstructor, Query, StorageService } from './StorageService'

import { RecordDuplicateError, RecordNotFoundError } from '../error'

import { RepositoryEventTypes } from './RepositoryEvents'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Repository<T extends BaseRecord<any, any, any>> {
  private storageService: StorageService<T>
  private recordClass: BaseRecordConstructor<T>
  private eventEmitter: EventEmitter

  public constructor(
    recordClass: BaseRecordConstructor<T>,
    storageService: StorageService<T>,
    eventEmitter: EventEmitter
  ) {
    this.storageService = storageService
    this.recordClass = recordClass
    this.eventEmitter = eventEmitter
  }

  /** @inheritDoc {StorageService#save} */
  public async save(record: T): Promise<void> {
    await this.storageService.save(record)
    this.eventEmitter.emit<RecordSavedEvent<T>>({
      type: RepositoryEventTypes.RecordSaved,
      payload: {
        record,
      },
    })
  }

  /** @inheritDoc {StorageService#update} */
  public async update(record: T): Promise<void> {
    await this.storageService.update(record)
    this.eventEmitter.emit<RecordUpdatedEvent<T>>({
      type: RepositoryEventTypes.RecordUpdated,
      payload: {
        record,
      },
    })
  }

  /** @inheritDoc {StorageService#delete} */
  public async delete(record: T): Promise<void> {
    await this.storageService.delete(record)
    this.eventEmitter.emit<RecordDeletedEvent<T>>({
      type: RepositoryEventTypes.RecordDeleted,
      payload: {
        record,
      },
    })
  }

  /** @inheritDoc {StorageService#getById} */
  public async getById(id: string): Promise<T> {
    return this.storageService.getById(this.recordClass, id)
  }

  /**
   * Find record by id. Returns null if no record is found
   * @param id the id of the record to retrieve
   * @returns
   */
  public async findById(id: string): Promise<T | null> {
    try {
      return await this.storageService.getById(this.recordClass, id)
    } catch (error) {
      if (error instanceof RecordNotFoundError) return null

      throw error
    }
  }

  /** @inheritDoc {StorageService#getAll} */
  public async getAll(): Promise<T[]> {
    return this.storageService.getAll(this.recordClass)
  }

  /** @inheritDoc {StorageService#findByQuery} */
  public async findByQuery(query: Query<T>): Promise<T[]> {
    return this.storageService.findByQuery(this.recordClass, query)
  }

  /**
   * Find a single record by query. Returns null if not found.
   * @param query the query
   * @returns the record, or null if not found
   * @throws {RecordDuplicateError} if multiple records are found for the given query
   */
  public async findSingleByQuery(query: Query<T>): Promise<T | null> {
    const records = await this.findByQuery(query)

    if (records.length > 1) {
      throw new RecordDuplicateError(`Multiple records found for given query '${JSON.stringify(query)}'`, {
        recordType: this.recordClass.type,
      })
    }

    if (records.length < 1) {
      return null
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
  public async getSingleByQuery(query: Query<T>): Promise<T> {
    const record = await this.findSingleByQuery(query)

    if (!record) {
      throw new RecordNotFoundError(`No record found for given query '${JSON.stringify(query)}'`, {
        recordType: this.recordClass.type,
      })
    }

    return record
  }
}
