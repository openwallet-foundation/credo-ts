import type { AgentContext } from '@credo-ts/core'

import {
  CacheModuleConfig,
  EventEmitter,
  InjectionSymbols,
  Repository,
  StorageService,
  inject,
  injectable,
} from '@credo-ts/core'

import { DidExchangeRole } from '../models'
import { ConnectionRecord } from './ConnectionRecord'

@injectable()
export class ConnectionRepository extends Repository<ConnectionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ConnectionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ConnectionRecord, storageService, eventEmitter)
  }

  public async findByDids(agentContext: AgentContext, { ourDid, theirDid }: { ourDid: string; theirDid: string }) {
    const cache = agentContext.resolveOptionally(CacheModuleConfig)
    const useCacheStorage = cache?.useCachedStorageService ?? false

    if (useCacheStorage) {
      const cachedKey = `ourDid${ourDid}theirDid${theirDid}`
      const recordId = (await cache?.cache.get<string>(agentContext, cachedKey)) ?? null
      if (recordId !== null) {
        return await cache?.cache.get<ConnectionRecord>(agentContext, recordId)
      }
    }

    const found = await this.findSingleByQuery(agentContext, {
      $or: [
        {
          did: ourDid,
          theirDid,
        },
        { did: ourDid, previousTheirDids: [theirDid] },
        { previousDids: [ourDid], theirDid },
      ],
    })

    if (found) {
      if (useCacheStorage) {
        const cachedKey = `ourDid${ourDid}theirDid${theirDid}`
        await cache?.cache.set(agentContext, cachedKey, found.id)
        await cache?.cache.set(agentContext, found.id, found.toJSON())
      }
    }

    return found
  }

  public getByThreadId(agentContext: AgentContext, threadId: string): Promise<ConnectionRecord> {
    return this.getSingleByQuery(agentContext, { threadId })
  }

  public getByRoleAndThreadId(
    agentContext: AgentContext,
    role: DidExchangeRole,
    threadId: string
  ): Promise<ConnectionRecord> {
    return this.getSingleByQuery(agentContext, { threadId, role })
  }
}
