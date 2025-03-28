import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { CredentialExchangeRecord } from './CredentialExchangeRecord'

@injectable()
export class CredentialRepository extends Repository<CredentialExchangeRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<CredentialExchangeRecord>,
    eventEmitter: EventEmitter
  ) {
    super(CredentialExchangeRecord, storageService, eventEmitter)
  }
}
