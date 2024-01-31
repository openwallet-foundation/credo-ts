import { Repository, StorageService, InjectionSymbols, EventEmitter, inject, injectable } from '@credo-ts/core'

import { TenantRecord } from './TenantRecord'

@injectable()
export class TenantRepository extends Repository<TenantRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<TenantRecord>,
    eventEmitter: EventEmitter
  ) {
    super(TenantRecord, storageService, eventEmitter)
  }
}
