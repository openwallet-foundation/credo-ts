import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { DrpcRecord } from './DrpcRecord'

@injectable()
export class DrpcRepository extends Repository<DrpcRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DrpcRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DrpcRecord, storageService, eventEmitter)
  }
}
