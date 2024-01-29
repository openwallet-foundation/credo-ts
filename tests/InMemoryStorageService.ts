import type { AgentContext } from '../packages/core/src/agent'
import type { BaseRecord, TagsBase } from '../packages/core/src/storage/BaseRecord'
import type { StorageService, BaseRecordConstructor, Query } from '../packages/core/src/storage/StorageService'

import { RecordNotFoundError, RecordDuplicateError, JsonTransformer, injectable } from '@credo-ts/core'

interface StorageRecord {
  value: Record<string, unknown>
  tags: Record<string, unknown>
  type: string
  id: string
}

interface InMemoryRecords {
  [id: string]: StorageRecord
}

@injectable()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class InMemoryStorageService<T extends BaseRecord<any, any, any> = BaseRecord<any, any, any>>
  implements StorageService<T>
{
  public records: InMemoryRecords

  public constructor(records: InMemoryRecords = {}) {
    this.records = records
  }

  private recordToInstance(record: StorageRecord, recordClass: BaseRecordConstructor<T>): T {
    const instance = JsonTransformer.fromJSON<T>(record.value, recordClass)
    instance.id = record.id
    instance.replaceTags(record.tags as TagsBase)

    return instance
  }

  /** @inheritDoc */
  public async save(agentContext: AgentContext, record: T) {
    record.updatedAt = new Date()
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
  public async update(agentContext: AgentContext, record: T): Promise<void> {
    record.updatedAt = new Date()
    const value = JsonTransformer.toJSON(record)
    delete value._tags

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
  public async delete(agentContext: AgentContext, record: T) {
    if (!this.records[record.id]) {
      throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
        recordType: record.type,
      })
    }

    delete this.records[record.id]
  }

  /** @inheritDoc */
  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    if (!this.records[id]) {
      throw new RecordNotFoundError(`record with id ${id} not found.`, {
        recordType: recordClass.type,
      })
    }

    delete this.records[id]
  }

  /** @inheritDoc */
  public async getById(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    const record = this.records[id]

    if (!record) {
      throw new RecordNotFoundError(`record with id ${id} not found.`, {
        recordType: recordClass.type,
      })
    }

    return this.recordToInstance(record, recordClass)
  }

  /** @inheritDoc */
  public async getAll(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    const records = Object.values(this.records)
      .filter((record) => record.type === recordClass.type)
      .map((record) => this.recordToInstance(record, recordClass))

    return records
  }

  /** @inheritDoc */
  public async findByQuery(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    query: Query<T>
  ): Promise<T[]> {
    const records = Object.values(this.records)
      .filter((record) => record.type === recordClass.type)
      .filter((record) => filterByQuery(record, query))
      .map((record) => this.recordToInstance(record, recordClass))

    return records
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterByQuery<T extends BaseRecord<any, any, any>>(record: StorageRecord, query: Query<T>) {
  const { $and, $or, $not, ...restQuery } = query

  if ($not) {
    throw new Error('$not query not supported in in memory storage')
  }

  // Top level query
  if (!matchSimpleQuery(record, restQuery)) return false

  // All $and queries MUST match
  if ($and) {
    const allAndMatch = ($and as Query<T>[]).every((and) => filterByQuery(record, and))
    if (!allAndMatch) return false
  }

  // Only one $or queries has to match
  if ($or) {
    const oneOrMatch = ($or as Query<T>[]).some((or) => filterByQuery(record, or))
    if (!oneOrMatch) return false
  }

  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchSimpleQuery<T extends BaseRecord<any, any, any>>(record: StorageRecord, query: Query<T>) {
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
}
