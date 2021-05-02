import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { ProvisioningRecord } from './ProvisioningRecord'
import { StorageService } from '../../../storage/StorageService'

@scoped(Lifecycle.ContainerScoped)
export class ProvisioningRepository extends Repository<ProvisioningRecord> {
  public constructor(@inject('StorageService') storageService: StorageService<ProvisioningRecord>) {
    super(ProvisioningRecord, storageService)
  }
}
