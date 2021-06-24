import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { MediationRecord } from './MediationRecord'

@scoped(Lifecycle.ContainerScoped)
export class MediationRepository extends Repository<MediationRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<MediationRecord>) {
    super(MediationRecord, storageService)
  }
}
