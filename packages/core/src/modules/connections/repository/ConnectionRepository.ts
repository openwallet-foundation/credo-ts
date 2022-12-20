import type { AgentContext } from '../../../agent'
import type { DidExchangeRole } from '../models'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

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
    return this.findSingleByQuery(agentContext, {
      did: ourDid,
      theirDid,
    })
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
