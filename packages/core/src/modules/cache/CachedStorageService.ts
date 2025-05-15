import { AgentContext } from '../../agent'
import { BaseRecord } from '../../storage/BaseRecord'
import { BaseRecordConstructor, Query, QueryOptions, StorageService } from '../../storage/StorageService'
import { CacheModuleConfig } from './CacheModuleConfig'

// biome-ignore lint/suspicious/noExplicitAny:
export class CachedStorageService<T extends BaseRecord<any, any, any>> implements StorageService<T> {
  public constructor(private storageService: StorageService<T>) {}

  private cache(agentContext: AgentContext) {
    return agentContext.resolve(CacheModuleConfig).cache
  }

  private getCacheKey(options: { type: string; id: string }) {
    return `${options.type}:${options.id}`
  }

  public async save(agentContext: AgentContext, record: T): Promise<void> {
    if (record.useCache) {
      await this.cache(agentContext).set(agentContext, this.getCacheKey(record), record.toJSON())
    }

    return await this.storageService.save(agentContext, record)
  }

  public async update(agentContext: AgentContext, record: T): Promise<void> {
    if (record.useCache) {
      await this.cache(agentContext).set(agentContext, this.getCacheKey(record), record.toJSON())
    }

    return await this.storageService.update(agentContext, record)
  }

  public async delete(agentContext: AgentContext, record: T): Promise<void> {
    if (record.useCache) {
      await this.cache(agentContext).remove(agentContext, this.getCacheKey(record))
    }
    return await this.storageService.delete(agentContext, record)
  }

  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    if (recordClass.useCache) {
      await this.cache(agentContext).remove(agentContext, this.getCacheKey({ ...recordClass, id }))
    }
    return await this.storageService.deleteById(agentContext, recordClass, id)
  }

  public async getById(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    if (recordClass.useCache) {
      const cachedValue = await this.cache(agentContext).get<T>(agentContext, `${recordClass.type}:${id}`)

      // TODO: class transform
      if (cachedValue) return cachedValue
    }

    return await this.storageService.getById(agentContext, recordClass, id)
  }

  // TODO: not in caching interface, yet
  public async getAll(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    return await this.storageService.getAll(agentContext, recordClass)
  }

  // TODO: not in caching interface, yet
  public async findByQuery(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    query: Query<T>,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    return await this.storageService.findByQuery(agentContext, recordClass, query, queryOptions)
  }
}
