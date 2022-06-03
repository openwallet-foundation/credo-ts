import type { Constructor } from '../utils/mixins'
import type { BaseRecord, TagsBase } from './BaseRecord'

// https://stackoverflow.com/questions/51954558/how-can-i-remove-a-wider-type-from-a-union-type-without-removing-its-subtypes-in/51955852#51955852
export type SimpleQuery<T extends BaseRecord> = Partial<ReturnType<T['getTags']>> & TagsBase

interface AdvancedQuery<T extends BaseRecord> {
  $and?: Query<T>[]
  $or?: Query<T>[]
  $not?: Query<T>
}

export type Query<T extends BaseRecord> = AdvancedQuery<T> | SimpleQuery<T>

export interface BaseRecordConstructor<T> extends Constructor<T> {
  type: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StorageService<T extends BaseRecord<any, any, any>> {
  /**
   * Save record in storage
   *
   * @param record the record to store
   * @throws {RecordDuplicateError} if a record with this id already exists
   */
  save(record: T): Promise<void>

  /**
   * Update record in storage
   *
   * @param record the record to update
   * @throws {RecordNotFoundError} if a record with this id and type does not exist
   */
  update(record: T): Promise<void>

  /**
   * Delete record from storage
   *
   * @param record the record to delete
   * @throws {RecordNotFoundError} if a record with this id and type does not exist
   */
  delete(record: T): Promise<void>

  /**
   * Get record by id.
   *
   * @param recordClass the record class to get the record for
   * @param id the id of the record to retrieve from storage
   * @throws {RecordNotFoundError} if a record with this id and type does not exist
   */
  getById(recordClass: BaseRecordConstructor<T>, id: string): Promise<T>

  /**
   * Get all records by specified record class.
   *
   * @param recordClass the record class to get records for
   */
  getAll(recordClass: BaseRecordConstructor<T>): Promise<T[]>

  /**
   * Find all records by specified record class and query.
   *
   * @param recordClass the record class to find records for
   * @param query the query to use for finding records
   */
  findByQuery(recordClass: BaseRecordConstructor<T>, query: Query<T>): Promise<T[]>
}
