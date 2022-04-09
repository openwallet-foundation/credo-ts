import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { NonSecretRecord } from './NonSecretRecord'

@scoped(Lifecycle.ContainerScoped)
export class NonSecretRecordRepository extends Repository<NonSecretRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<NonSecretRecord>) {
    super(NonSecretRecord, storageService)
  }
}
