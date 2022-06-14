import { inject, scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { OutOfBandRecord } from './OutOfBandRecord'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandRepository extends Repository<OutOfBandRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<OutOfBandRecord>,
    eventEmitter: EventEmitter
  ) {
    super(OutOfBandRecord, storageService, eventEmitter)
  }
}
