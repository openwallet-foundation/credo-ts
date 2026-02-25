import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'

import { GenericRecord } from './GenericRecord'

@injectable()
export class GenericRecordsRepository extends Repository<GenericRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<GenericRecord>,
    eventEmitter: EventEmitter
  ) {
    super(GenericRecord, storageService, eventEmitter)
  }
}
