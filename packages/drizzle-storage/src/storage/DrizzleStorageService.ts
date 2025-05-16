import type {
  AgentContext,
  BaseRecord,
  BaseRecordConstructor,
  Query,
  QueryOptions,
  StorageService,
} from '@credo-ts/core'
import { injectable } from '@credo-ts/core'
import { DrizzleStorageModuleConfig } from '../DrizzleStorageModuleConfig'
import { BaseDrizzleRecordAdapter } from '../adapter/BaseDrizzleRecordAdapter'
import { CredoDrizzleStorageError } from '../error/CredoDrizzleStorageError'

@injectable()
export class DrizzleStorageService<T extends BaseRecord> implements StorageService<T> {
  public constructor(public config: DrizzleStorageModuleConfig) {}

  private getAdapterForRecordType(recordType: string) {
    const adapter = this.config.adapters.find((adapter) => adapter.recordType === recordType)
    if (!adapter) {
      throw new CredoDrizzleStorageError(
        `Could not find a registered drizzle adapter for record type '${recordType}'. Make sure to register the record type in the DrizzleStorageModule.`
      )
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return adapter as BaseDrizzleRecordAdapter<T, any, any, any, any>
  }

  public async save(_agentContext: AgentContext, record: T): Promise<void> {
    const adapter = this.getAdapterForRecordType(record.type)

    // TOOD: duplicate
    await adapter.insert(record)
  }

  public async update(_agentContext: AgentContext, record: T): Promise<void> {
    const adapter = this.getAdapterForRecordType(record.type)

    // TOOD: not found
    await adapter.update(record)
  }

  public async delete(_agentContext: AgentContext, record: T): Promise<void> {
    const adapter = this.getAdapterForRecordType(record.type)

    // TOOD: not found
    await adapter.delete(record.id)
  }

  public async deleteById(
    _agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    // TOOD: not found
    await adapter.delete(id)
  }

  public async getById(_agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    // TODO: what if not found?
    const record = await adapter.getById(id)
    return record
  }

  public async getAll(_agentContext: AgentContext, recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    const records = await adapter.query()
    return records
  }

  public async findByQuery(
    _agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    query: Query<T>,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    const records = await adapter.query(query, queryOptions)
    return records
  }
}
