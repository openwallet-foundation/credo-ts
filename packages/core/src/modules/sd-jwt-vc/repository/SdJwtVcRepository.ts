import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { SdJwtVcRecord } from './SdJwtVcRecord'

@injectable()
export class SdJwtVcRepository extends Repository<SdJwtVcRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<SdJwtVcRecord>,
    eventEmitter: EventEmitter
  ) {
    super(SdJwtVcRecord, storageService, eventEmitter)
  }
}
