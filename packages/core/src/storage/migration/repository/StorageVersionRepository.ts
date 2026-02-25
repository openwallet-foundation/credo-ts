import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../Repository'
import type { StorageService } from '../../StorageService'

import { StorageVersionRecord } from './StorageVersionRecord'

@injectable()
export class StorageVersionRepository extends Repository<StorageVersionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<StorageVersionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(StorageVersionRecord, storageService, eventEmitter)
  }
}
