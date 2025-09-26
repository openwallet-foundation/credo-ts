import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { DidCommBasicMessageRecord } from './DidCommBasicMessageRecord'

@injectable()
export class DidCommBasicMessageRepository extends Repository<DidCommBasicMessageRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommBasicMessageRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommBasicMessageRecord, storageService, eventEmitter)
  }
}
