import { EventEmitter, InjectionSymbols, inject, injectable, Repository, StorageService } from '@credo-ts/core'

import { DrpcMessageRecord } from './DrpcMessageRecord'

@injectable()
export class DrpcMessageRepository extends Repository<DrpcMessageRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DrpcMessageRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DrpcMessageRecord, storageService, eventEmitter)
  }
}
