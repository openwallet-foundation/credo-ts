import { Repository, StorageService, InjectionSymbols, EventEmitter, inject, injectable } from '@aries-framework/core'

import { DummyRecord } from './DummyRecord'

@injectable()
export class DummyRepository extends Repository<DummyRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DummyRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DummyRecord, storageService, eventEmitter)
  }
}
