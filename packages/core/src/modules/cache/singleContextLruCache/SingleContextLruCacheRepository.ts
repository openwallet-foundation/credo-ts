import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'

import { SingleContextLruCacheRecord } from './SingleContextLruCacheRecord'

@injectable()
export class SingleContextLruCacheRepository extends Repository<SingleContextLruCacheRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<SingleContextLruCacheRecord>,
    eventEmitter: EventEmitter
  ) {
    super(SingleContextLruCacheRecord, storageService, eventEmitter)
  }
}
