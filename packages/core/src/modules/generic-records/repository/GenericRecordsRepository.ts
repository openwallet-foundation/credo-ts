import { inject, scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { GenericRecord } from './GenericRecord'

@scoped(Lifecycle.ContainerScoped)
export class GenericRecordsRepository extends Repository<GenericRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<GenericRecord>,
    eventEmitter: EventEmitter
  ) {
    super(GenericRecord, storageService, eventEmitter)
  }
}
