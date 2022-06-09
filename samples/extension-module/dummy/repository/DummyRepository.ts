import { Repository, StorageService, InjectionSymbols, EventEmitter } from '@aries-framework/core'
import { inject, scoped, Lifecycle } from 'tsyringe'

import { DummyRecord } from './DummyRecord'

@scoped(Lifecycle.ContainerScoped)
export class DummyRepository extends Repository<DummyRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DummyRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DummyRecord, storageService, eventEmitter)
  }
}
