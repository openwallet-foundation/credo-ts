import type { AgentContext } from '@credo-ts/core'

import {
  CacheModuleConfig,
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
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

  public async findByDids(
    agentContext: AgentContext,
    { ourDid, theirDid }: { ourDid: string; theirDid: string }
  ): Promise<DidCommConnectionRecord | null> {
    const cacheKey = `ourDid${ourDid}theirDid${theirDid}`
    const cache = agentContext.resolve(CacheModuleConfig)
    if (cache.useCachedStorageService) {
      const recordId = await cache.cache.get<string>(agentContext, cacheKey)
      const cachedConnection = recordId ? await this.findById(agentContext, recordId) : null
      if (cachedConnection) return cachedConnection
    }

    const connections = await this.findByQuery(agentContext, {
      $or: [
        {
          did: ourDid,
          theirDid,
        },
        { did: ourDid, previousTheirDids: [theirDid] },
        { previousDids: [ourDid], theirDid },
      ],
    })
    // Messages from a superseded peer DID are dropped, so current DIDs rank first
    const rank = (connection: DidCommConnectionRecord): number =>
      (connection.theirDid === theirDid ? 0 : 2) + (connection.did === ourDid ? 0 : 1)
    const [connection, ...others] = connections.sort(
      (a, b) => rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime()
    )
    if (!connection) return null
    if (others.length > 0) {
      agentContext.config.logger.warn('More than one connection matches the DID pair, using the closest match', {
        ourDid,
        theirDid,
        connectionId: connection.id,
        otherConnectionIds: others.map(({ id }) => id),
      })
    }

    if (cache.useCachedStorageService) {
      await cache.cache.set(agentContext, cacheKey, connection.id)
    }
    return connection
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
