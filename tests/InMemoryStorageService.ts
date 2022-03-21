import type { BaseRecord, TagsBase } from '../packages/core/src/storage/BaseRecord'
import type { StorageService, BaseRecordConstructor } from '../packages/core/src/storage/StorageService'

import { scoped, Lifecycle } from 'tsyringe'

import { RecordNotFoundError, RecordDuplicateError, JsonTransformer } from '@aries-framework/core'

interface StorageRecord {
  value: Record<string, unknown>
  tags: Record<string, unknown>
  type: string
  id: string
}

@scoped(Lifecycle.ContainerScoped)
export class InMemoryStorageService<T extends BaseRecord> implements StorageService<T> {
  public readonly records: { [id: string]: StorageRecord } = {}

  private recordToInstance(record: StorageRecord, recordClass: BaseRecordConstructor<T>): T {
    const instance = JsonTransformer.fromJSON<T>(record.value, recordClass)
    instance.id = record.id
    instance.replaceTags(record.tags as TagsBase)

    return instance
  }

  /** @inheritDoc */
  public async save(record: T) {
    const value = JsonTransformer.toJSON(record)

    if (this.records[record.id]) {
      throw new RecordDuplicateError(`Record with id ${record.id} already exists`, { recordType: record.type })
    }

    this.records[record.id] = {
      value,
      id: record.id,
      type: record.type,
      tags: record.getTags(),
    }
  }

  /** @inheritDoc */
  public async update(record: T): Promise<void> {
    const value = JsonTransformer.toJSON(record)

    if (!this.records[record.id]) {
      throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
        recordType: record.type,
      })
    }

    this.records[record.id] = {
      value,
      id: record.id,
      type: record.type,
      tags: record.getTags(),
    }
  }

  /** @inheritDoc */
  public async delete(record: T) {
    if (!this.records[record.id]) {
      throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
        recordType: record.type,
      })
    }

    delete this.records[record.id]
  }

  /** @inheritDoc */
  public async getById(recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    const record = this.records[id]

    if (!record) {
      throw new RecordNotFoundError(`record with id ${id} not found.`, {
        recordType: recordClass.type,
      })
    }

    return this.recordToInstance(record, recordClass)
  }

  /** @inheritDoc */
  public async getAll(recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    const records = Object.values(this.records)
      .filter((record) => record.type === recordClass.type)
      .map((record) => this.recordToInstance(record, recordClass))

    return records
  }

  /** @inheritDoc */
  public async findByQuery(
    recordClass: BaseRecordConstructor<T>,
    query: Partial<ReturnType<T['getTags']>>
  ): Promise<T[]> {
    const records = Object.values(this.records)
      .filter((record) => {
        const tags = record.tags as TagsBase

        for (const [key, value] of Object.entries(query)) {
          if (Array.isArray(value)) {
            const tagValue = tags[key]
            if (!Array.isArray(tagValue) || !value.every((v) => tagValue.includes(v))) {
              return false
            }
          } else if (tags[key] !== value) {
            return false
          }
        }

        return true
      })
      .map((record) => this.recordToInstance(record, recordClass))

    return records
  }
}
