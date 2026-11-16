import type { AgentContext, Kms, Query, QueryOptions } from '@credo-ts/core'
import {
  CacheModuleConfig,
  injectable,
  isStorageUpToDate,
  SingleContextStorageLruCache,
  UpdateAssistant,
  utils,
} from '@credo-ts/core'
import type { TenantConfig } from '../models/TenantConfig'

import { TenantRecord, TenantRepository, TenantRoutingRecord, TenantRoutingRepository } from '../repository'
import { TenantsModuleConfig } from '../TenantsModuleConfig'

export type TenantSessionProperties = Pick<TenantRecord, 'id' | 'status' | 'storageVersion'>

@injectable()
export class TenantRecordService {
  private tenantRepository: TenantRepository
  private tenantRoutingRepository: TenantRoutingRepository
  private hasWarnedAboutCache = false

  public constructor(tenantRepository: TenantRepository, tenantRoutingRepository: TenantRoutingRepository) {
    this.tenantRepository = tenantRepository
    this.tenantRoutingRepository = tenantRoutingRepository
  }

  public async createTenant(agentContext: AgentContext, config: TenantConfig) {
    const tenantId = utils.uuid()

    const tenantRecord = new TenantRecord({
      id: tenantId,
      config,
      storageVersion: UpdateAssistant.frameworkStorageVersion,
    })

    await this.tenantRepository.save(agentContext, tenantRecord)

    return tenantRecord
  }

  public async getTenantById(agentContext: AgentContext, tenantId: string) {
    return this.tenantRepository.getById(agentContext, tenantId)
  }

  /**
   * The properties of the tenant record needed to open a session, served from the tenant record
   * cache unless it is disabled. They can be outdated, so only use them to open a session.
   */
  public async getTenantByIdForSession(agentContext: AgentContext, tenantId: string): Promise<TenantSessionProperties> {
    const cache = this.getCache(agentContext)
    if (!cache) return this.getTenantById(agentContext, tenantId)

    const cached = await cache.cache.get<TenantSessionProperties>(agentContext, this.getCacheKey(tenantId))
    if (cached) {
      if (isStorageUpToDate(cached.storageVersion)) return cached

      agentContext.config.logger.warn(
        `Cached tenant record for tenant '${tenantId}' has outdated storage version ${cached.storageVersion}. Reading the record from storage instead.`
      )
    }

    const tenantRecord = await this.getTenantById(agentContext, tenantId)

    // Outdated storage is about to be updated, which changes the record
    if (isStorageUpToDate(tenantRecord.storageVersion)) {
      // Never cache the whole record, it can hold the key of the tenant's store
      const { id, status, storageVersion } = tenantRecord
      await cache.cache.set<TenantSessionProperties>(
        agentContext,
        this.getCacheKey(tenantId),
        { id, status, storageVersion },
        cache.expiryInSeconds
      )
    }

    return tenantRecord
  }

  public async findTenantsByLabel(agentContext: AgentContext, label: string) {
    return this.tenantRepository.findByLabel(agentContext, label)
  }

  public async getAllTenants(agentContext: AgentContext) {
    return this.tenantRepository.getAll(agentContext)
  }

  public async deleteTenantById(agentContext: AgentContext, tenantId: string) {
    const tenantRecord = await this.getTenantById(agentContext, tenantId)

    const tenantRoutingRecords = await this.tenantRoutingRepository.findByQuery(agentContext, {
      tenantId: tenantRecord.id,
    })

    // Delete all tenant routing records
    await Promise.all(
      tenantRoutingRecords.map((tenantRoutingRecord) =>
        this.tenantRoutingRepository.delete(agentContext, tenantRoutingRecord)
      )
    )

    // Delete tenant record
    await this.tenantRepository.delete(agentContext, tenantRecord)
    await this.removeFromCache(agentContext, tenantId)
  }

  public async updateTenant(agentContext: AgentContext, tenantRecord: TenantRecord) {
    await this.tenantRepository.update(agentContext, tenantRecord)
    await this.removeFromCache(agentContext, tenantRecord.id)
  }

  public async findTenantsByQuery(agentContext: AgentContext, query: Query<TenantRecord>, queryOptions?: QueryOptions) {
    return this.tenantRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async findTenantRoutingRecordByRecipientKey(
    agentContext: AgentContext,
    recipientKey: Kms.PublicJwk
  ): Promise<TenantRoutingRecord | null> {
    return this.tenantRoutingRepository.findByRecipientKey(agentContext, recipientKey)
  }

  public async addTenantRoutingRecord(
    agentContext: AgentContext,
    tenantId: string,
    recipientKey: Kms.PublicJwk
  ): Promise<TenantRoutingRecord> {
    const tenantRoutingRecord = new TenantRoutingRecord({
      tenantId,
      recipientKeyFingerprint: recipientKey.fingerprint,
    })

    await this.tenantRoutingRepository.save(agentContext, tenantRoutingRecord)

    return tenantRoutingRecord
  }

  private getCacheKey(tenantId: string) {
    return `tenants:tenant-record:${tenantId}`
  }

  private async removeFromCache(agentContext: AgentContext, tenantId: string) {
    await this.getCache(agentContext)?.cache.remove(agentContext, this.getCacheKey(tenantId))
  }

  private getCache(agentContext: AgentContext) {
    const options = agentContext.resolve(TenantsModuleConfig).tenantRecordCache
    if (!options) return undefined

    const cache = agentContext.resolve(CacheModuleConfig).cache

    // This cache writes to storage on every change and only supports one agent context
    if (cache instanceof SingleContextStorageLruCache) {
      if (!this.hasWarnedAboutCache) {
        agentContext.config.logger.warn(
          "The tenant record cache is not used with the 'SingleContextStorageLruCache'. Register the 'CacheModule' with another cache, such as the 'InMemoryLruCache' or the 'RedisCache' from '@credo-ts/redis-cache', or set 'tenantRecordCache' to false in the tenants module config."
        )
        this.hasWarnedAboutCache = true
      }
      return undefined
    }

    return { cache, expiryInSeconds: options.expiryInSeconds }
  }
}
