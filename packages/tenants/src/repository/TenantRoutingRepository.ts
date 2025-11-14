import type { AgentContext, Kms } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'

import { TenantRoutingRecord } from './TenantRoutingRecord'

@injectable()
export class TenantRoutingRepository extends Repository<TenantRoutingRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<TenantRoutingRecord>,
    eventEmitter: EventEmitter
  ) {
    super(TenantRoutingRecord, storageService, eventEmitter)
  }

  public findByRecipientKey(agentContext: AgentContext, publicJwk: Kms.PublicJwk) {
    return this.findSingleByQuery(agentContext, {
      recipientKeyFingerprint: publicJwk.fingerprint,
    })
  }
}
