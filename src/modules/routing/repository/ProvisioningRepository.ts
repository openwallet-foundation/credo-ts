import type { StorageService } from '../../../storage/StorageService'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'

import { ProvisioningRecord } from './ProvisioningRecord'

@scoped(Lifecycle.ContainerScoped)
export class ProvisioningRepository extends Repository<ProvisioningRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<ProvisioningRecord>) {
    super(ProvisioningRecord, storageService)
  }
}
