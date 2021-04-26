import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { MediationRecord } from './MediationRecord'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

@scoped(Lifecycle.ContainerScoped)
export class MediationRepository extends Repository<MediationRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<MediationRecord>) {
    super(MediationRecord, storageService)
  }
}
