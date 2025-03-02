import type { AgentContext, Key } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { TenantRoutingRecord } from './TenantRoutingRecord'

@injectable()
export class TenantRoutingRepository extends Repository<TenantRoutingRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<TenantRoutingRecord>,
    eventEmitter: EventEmitter
  ) {
    super(TenantRoutingRecord, storageService, eventEmitter)
  }

  public findByRecipientKey(agentContext: AgentContext, key: Key) {
    return this.findSingleByQuery(agentContext, {
      recipientKeyFingerprint: key.fingerprint,
    })
  }
}
