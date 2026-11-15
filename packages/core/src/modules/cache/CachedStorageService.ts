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
  public readonly supportsCursorPagination = false

  public constructor(@inject(InjectionSymbols.StorageService) private storageService: StorageService<T>) {}

  private cache(agentContext: AgentContext) {
    return agentContext.resolve(CacheModuleConfig).cache
  }

  private getCacheKey(options: { type: string; id: string }) {
    return `${options.type}:${options.id}`
  }

  public async save(agentContext: AgentContext, record: T): Promise<void> {
    await this.storageService.save(agentContext, record)

    if (record.allowCache) {
      await this.cache(agentContext).set(agentContext, this.getCacheKey(record), record.toJSON())
    }
  }

  public async update(agentContext: AgentContext, record: T): Promise<void> {
    await this.storageService.update(agentContext, record)
    // Removed rather than set, as a set that arrives late or out of order can put an older version back.
    if (record.allowCache) await this.cache(agentContext).remove(agentContext, this.getCacheKey(record))
  }

  public supportsLocking(agentContext: AgentContext): boolean {
    return this.storageService.supportsLocking?.(agentContext) ?? false
  }

  // Implemented even when the wrapped storage service can't lock, otherwise Repository can't tell whether it can
  public async updateByIdWithLock(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string,
    updateCallback: (record: T) => Promise<T>
  ): Promise<T> {
    if (!this.storageService.updateByIdWithLock) {
      const updatedRecord = await updateCallback(await this.storageService.getById(agentContext, recordClass, id))
      await this.update(agentContext, updatedRecord)
      return updatedRecord
    }

    const updatedRecord = await this.storageService.updateByIdWithLock(agentContext, recordClass, id, updateCallback)
    if (recordClass.allowCache) {
      await this.cache(agentContext).remove(agentContext, this.getCacheKey({ type: recordClass.type, id }))
    }
    return updatedRecord
  }

  public async delete(agentContext: AgentContext, record: T): Promise<void> {
    await this.storageService.delete(agentContext, record)
    if (record.allowCache) await this.cache(agentContext).remove(agentContext, this.getCacheKey(record))
  }

  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    await this.storageService.deleteById(agentContext, recordClass, id)
    if (recordClass.allowCache) {
      await this.cache(agentContext).remove(agentContext, this.getCacheKey({ type: recordClass.type, id }))
    }
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
