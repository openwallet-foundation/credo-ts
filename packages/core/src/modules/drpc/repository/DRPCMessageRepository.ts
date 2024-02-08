import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { DRPCMessageRecord } from './DRPCMessageRecord'

@injectable()
export class DRPCMessageRepository extends Repository<DRPCMessageRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DRPCMessageRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DRPCMessageRecord, storageService, eventEmitter)
  }
}
