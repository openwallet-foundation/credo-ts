import { inject, scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../Repository'
import { StorageService } from '../../StorageService'

import { StorageVersionRecord } from './StorageVersionRecord'

@scoped(Lifecycle.ContainerScoped)
export class StorageVersionRepository extends Repository<StorageVersionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<StorageVersionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(StorageVersionRecord, storageService, eventEmitter)
  }
}
