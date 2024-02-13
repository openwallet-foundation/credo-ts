import { EventEmitter, InjectionSymbols, inject, injectable, Repository, StorageService } from '@credo-ts/core'

import { DRPCMessageRecord } from './DRPCMessageRecord'

@injectable()
export class DRPCMessageRepository extends Repository<DRPCMessageRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DRPCMessageRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DRPCMessageRecord, storageService, eventEmitter)
  }
}
