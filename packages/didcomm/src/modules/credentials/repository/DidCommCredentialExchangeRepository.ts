import { EventEmitter, InjectionSymbols, Repository, type StorageService, inject, injectable } from '@credo-ts/core'

import { DidCommCredentialExchangeRecord } from './DidCommCredentialExchangeRecord'

@injectable()
export class DidCommCredentialExchangeRepository extends Repository<DidCommCredentialExchangeRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommCredentialExchangeRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommCredentialExchangeRecord, storageService, eventEmitter)
  }
}
