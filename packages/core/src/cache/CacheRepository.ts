import { EventEmitter } from '../agent/EventEmitter'
import { InjectionSymbols } from '../constants'
import { inject, injectable } from '../plugins'
import { Repository } from '../storage/Repository'
import { StorageService } from '../storage/StorageService'

import { CacheRecord } from './CacheRecord'

@injectable()
export class CacheRepository extends Repository<CacheRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<CacheRecord>,
    eventEmitter: EventEmitter
  ) {
    super(CacheRecord, storageService, eventEmitter)
  }
}
