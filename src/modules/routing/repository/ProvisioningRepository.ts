import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

import { ProvisioningRecord } from './ProvisioningRecord'

@scoped(Lifecycle.ContainerScoped)
export class ProvisioningRepository extends Repository<ProvisioningRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<ProvisioningRecord>) {
    super(ProvisioningRecord, storageService)
  }
}
