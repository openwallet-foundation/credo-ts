import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { BasicMessageRecord } from './BasicMessageRecord'

@injectable()
export class BasicMessageRepository extends Repository<BasicMessageRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<BasicMessageRecord>,
    eventEmitter: EventEmitter
  ) {
    super(BasicMessageRecord, storageService, eventEmitter)
  }
}
