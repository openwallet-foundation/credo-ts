import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { DidCommMediationRecord } from './DidCommMediationRecord'

@injectable()
export class DidCommMediationRepository extends Repository<DidCommMediationRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommMediationRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommMediationRecord, storageService, eventEmitter)
  }

  public getSingleByRecipientKey(agentContext: AgentContext, recipientKey: string) {
    return this.getSingleByQuery(agentContext, {
      recipientKeys: [recipientKey],
    })
  }

  public async getByConnectionId(agentContext: AgentContext, connectionId: string): Promise<DidCommMediationRecord> {
    return this.getSingleByQuery(agentContext, { connectionId })
  }
}
