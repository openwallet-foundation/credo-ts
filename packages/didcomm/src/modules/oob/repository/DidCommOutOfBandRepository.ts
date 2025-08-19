import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { DidCommOutOfBandRecord } from './DidCommOutOfBandRecord'

@injectable()
export class DidCommOutOfBandRepository extends Repository<DidCommOutOfBandRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommOutOfBandRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommOutOfBandRecord, storageService, eventEmitter)
  }
}
