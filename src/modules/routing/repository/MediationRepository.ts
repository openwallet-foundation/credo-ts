import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { MediationRecord } from './MediationRecord'
import { StorageService } from '../../../storage/StorageService'


@scoped(Lifecycle.ContainerScoped)
export class MediationRepository extends Repository<MediationRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<MediationRecord>) {
    super(MediationRecord, storageService)
  }
}
