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

  public async save(agentContext: AgentContext, record: T): Promise<void> {
    record.createdAt = record.createdAt ?? new Date()
    record.updatedAt = record.createdAt

    const adapter = this.getAdapterForRecordType(record.type)

    // TOOD: duplicate
    await adapter.insert(agentContext, record)
  }

  public async update(agentContext: AgentContext, record: T): Promise<void> {
    record.updatedAt = new Date()

    const adapter = this.getAdapterForRecordType(record.type)
    await adapter.update(agentContext, record)
  }

  public async delete(agentContext: AgentContext, record: T): Promise<void> {
    const adapter = this.getAdapterForRecordType(record.type)
    await adapter.delete(agentContext, record.id)
  }

  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    await adapter.delete(agentContext, id)
  }

  public async getById(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    const record = await adapter.getById(agentContext, id)
    return record
  }

  public async getAll(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    const records = await adapter.query(agentContext)
    return records
  }

  public async findByQuery(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    query: Query<T>,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    const adapter = this.getAdapterForRecordType(recordClass.type)

    const records = await adapter.query(agentContext, query, queryOptions)
    return records
  }
}
