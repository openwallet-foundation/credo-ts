import { EventEmitter, InjectionSymbols, inject, injectable, Repository, StorageService } from '@aries-framework/core'

import { SdJwtRecord } from './SdJwtRecord'

@injectable()
export class SdJwtRepository extends Repository<SdJwtRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<SdJwtRecord>,
    eventEmitter: EventEmitter
  ) {
    super(SdJwtRecord, storageService, eventEmitter)
  }
}
