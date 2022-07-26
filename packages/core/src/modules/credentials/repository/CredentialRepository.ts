import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

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
