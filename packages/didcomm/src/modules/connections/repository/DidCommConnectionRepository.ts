import type { AgentContext } from '@credo-ts/core'

import {
  CacheModuleConfig,
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
  JsonTransformer,
  RecordDuplicateError,
  Repository,
  type StorageService,
} from '@credo-ts/core'

import { DidCommDidExchangeRole } from '../models'
import { DidCommConnectionRecord } from './DidCommConnectionRecord'

@injectable()
export class DidCommConnectionRepository extends Repository<DidCommConnectionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommConnectionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommConnectionRecord, storageService, eventEmitter)
  }

  public async findByDids(agentContext: AgentContext, { ourDid, theirDid }: { ourDid: string; theirDid: string }) {
    const cache = agentContext.resolve(CacheModuleConfig)
    const cacheKey = `ourDid${ourDid}theirDid${theirDid}`
    if (cache.useCachedStorageService) {
      const recordId = await cache.cache.get<string>(agentContext, cacheKey)
      if (recordId) {
        const record = await cache.cache.get<DidCommConnectionRecord>(agentContext, recordId)
        if (record) return JsonTransformer.fromJSON(record, DidCommConnectionRecord)
      }
    }

    // Separate indexable clauses, running sequentially to avoid wallet-store locking.
    const byCurrentDids = await this.findByQuery(agentContext, { did: ourDid, theirDid })
    const byPreviousTheirDid = await this.findByQuery(agentContext, { did: ourDid, previousTheirDids: [theirDid] })
    const byPreviousOurDid = await this.findByQuery(agentContext, { previousDids: [ourDid], theirDid })
    const records = [
      ...new Map(
        [...byCurrentDids, ...byPreviousTheirDid, ...byPreviousOurDid].map((record) => [record.id, record])
      ).values(),
    ]

    if (records.length > 1) {
      throw new RecordDuplicateError(
        `Multiple records found for given query '${JSON.stringify({ ourDid, theirDid })}'`,
        { recordType: DidCommConnectionRecord.type }
      )
    }

    const record = records[0] ?? null
    if (record && cache.useCachedStorageService) {
      await cache.cache.set(agentContext, cacheKey, record.id)
      await cache.cache.set(agentContext, record.id, record.toJSON())
    }
    return record
  }

  public getByThreadId(agentContext: AgentContext, threadId: string): Promise<DidCommConnectionRecord> {
    return this.getSingleByQuery(agentContext, { threadId })
  }

  public getByRoleAndThreadId(
    agentContext: AgentContext,
    role: DidCommDidExchangeRole,
    threadId: string
  ): Promise<DidCommConnectionRecord> {
    return this.getSingleByQuery(agentContext, { threadId, role })
  }
}
