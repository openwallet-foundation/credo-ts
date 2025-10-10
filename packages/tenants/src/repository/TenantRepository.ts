import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, Repository, type StorageService, inject, injectable } from '@credo-ts/core'

import { TenantRecord } from './TenantRecord'

@injectable()
export class TenantRepository extends Repository<TenantRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<TenantRecord>,
    eventEmitter: EventEmitter
  ) {
    super(TenantRecord, storageService, eventEmitter)
  }

  public async findByLabel(agentContext: AgentContext, label: string): Promise<TenantRecord[]> {
    return this.findByQuery(agentContext, { label })
  }
}
