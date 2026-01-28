import { AgentContext } from '../../agent'
import { InjectionSymbols } from '../../constants'
import { inject, injectable } from '../../plugins'
import { BaseRecord } from '../../storage/BaseRecord'
import type { BaseRecordConstructor, Query, QueryOptions, StorageService } from '../../storage/StorageService'
import { JsonTransformer } from '../../utils'
import { CacheModuleConfig } from './CacheModuleConfig'

@injectable()
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export class CachedStorageService<T extends BaseRecord<any, any, any>> implements StorageService<T> {
  public constructor(@inject(InjectionSymbols.StorageService) private storageService: StorageService<T>) {}

  private cache(agentContext: AgentContext) {
    return agentContext.resolve(CacheModuleConfig).cache
  }

  private getCacheKey(options: { type: string; id: string }) {
    return `${options.type}:${options.id}`
  }

  public async save(agentContext: AgentContext, record: T): Promise<void> {
    if (record.allowCache) {
      await this.cache(agentContext).set(agentContext, this.getCacheKey(record), record.toJSON())
    }

    return await this.storageService.save(agentContext, record)
  }

  public async update(agentContext: AgentContext, record: T): Promise<void> {
    if (record.allowCache) {
      await this.cache(agentContext).set(agentContext, this.getCacheKey(record), record.toJSON())
    }

    return await this.storageService.update(agentContext, record)
  }

  public async delete(agentContext: AgentContext, record: T): Promise<void> {
    if (record.allowCache) {
      await this.cache(agentContext).remove(agentContext, this.getCacheKey(record))
    }
    return await this.storageService.delete(agentContext, record)
  }

  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    if (recordClass.allowCache) {
      await this.cache(agentContext).remove(agentContext, this.getCacheKey({ ...recordClass, id }))
    }
    return await this.storageService.deleteById(agentContext, recordClass, id)
  }

  public async getById(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    if (recordClass.allowCache) {
      const cachedValue = await this.cache(agentContext).get<T>(
        agentContext,
        this.getCacheKey({ type: recordClass.type, id })
      )

      if (cachedValue) return JsonTransformer.fromJSON<T>(cachedValue, recordClass)
    }

    const record = await this.storageService.getById(agentContext, recordClass, id)

    if (recordClass.allowCache) {
      await this.cache(agentContext).set(
        agentContext,
        this.getCacheKey({ type: recordClass.type, id }),
        record.toJSON()
      )
    }

    return record
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
