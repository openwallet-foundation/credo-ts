import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../Repository'
import { StorageService } from '../../StorageService'

import { StorageVersionRecord } from './StorageVersionRecord'

@scoped(Lifecycle.ContainerScoped)
export class StorageVersionRepository extends Repository<StorageVersionRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<StorageVersionRecord>) {
    super(StorageVersionRecord, storageService)
  }
}
