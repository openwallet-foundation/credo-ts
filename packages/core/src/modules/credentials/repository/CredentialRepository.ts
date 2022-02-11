import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { CredentialExchangeRecord } from './CredentialRecord'

@scoped(Lifecycle.ContainerScoped)
export class CredentialRepository extends Repository<CredentialExchangeRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<CredentialExchangeRecord>
  ) {
    super(CredentialExchangeRecord, storageService)
  }
}
