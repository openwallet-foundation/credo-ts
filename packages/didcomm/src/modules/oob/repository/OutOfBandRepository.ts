import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { OutOfBandRecord } from './OutOfBandRecord'

@injectable()
export class OutOfBandRepository extends Repository<OutOfBandRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<OutOfBandRecord>,
    eventEmitter: EventEmitter
  ) {
    super(OutOfBandRecord, storageService, eventEmitter)
  }
}
