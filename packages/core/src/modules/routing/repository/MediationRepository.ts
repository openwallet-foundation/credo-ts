import type { AgentContext } from '../../../agent'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { MediationRecord } from './MediationRecord'

@injectable()
export class MediationRepository extends Repository<MediationRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<MediationRecord>,
    eventEmitter: EventEmitter
  ) {
    super(MediationRecord, storageService, eventEmitter)
  }

  public getSingleByRecipientKey(agentContext: AgentContext, recipientKey: string) {
    return this.getSingleByQuery(agentContext, {
      recipientKeys: [recipientKey],
    })
  }

  public async getByConnectionId(agentContext: AgentContext, connectionId: string): Promise<MediationRecord> {
    return this.getSingleByQuery(agentContext, { connectionId })
  }
}
