import type { AgentContext, Query } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'

import { DidCommDidExchangeRole } from '../models'
import { DidCommConnectionRecord } from './DidCommConnectionRecord'

function byDids({ ourDid, theirDid }: { ourDid: string; theirDid: string }): Query<DidCommConnectionRecord> {
  return {
    $or: [
      {
        did: ourDid,
        theirDid,
      },
      { did: ourDid, previousTheirDids: [theirDid] },
      { previousDids: [ourDid], theirDid },
    ],
  }
}

@injectable()
export class DidCommConnectionRepository extends Repository<DidCommConnectionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommConnectionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommConnectionRecord, storageService, eventEmitter)
  }

  public async findByDids(agentContext: AgentContext, { ourDid, theirDid }: { ourDid: string; theirDid: string }) {
    return this.findSingleByQuery(agentContext, byDids({ ourDid, theirDid }), {
      cacheKey: `ourDid${ourDid}theirDid${theirDid}`,
    })
  }

  public findAllByDids(
    agentContext: AgentContext,
    dids: { ourDid: string; theirDid: string }
  ): Promise<DidCommConnectionRecord[]> {
    return this.findByQuery(agentContext, byDids(dids))
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
