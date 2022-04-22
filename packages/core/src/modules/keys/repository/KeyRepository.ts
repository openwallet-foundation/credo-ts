import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { KeyRecord } from './KeyRecord'

@scoped(Lifecycle.ContainerScoped)
export class KeyRepository extends Repository<KeyRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<KeyRecord>) {
    super(KeyRecord, storageService)
  }
}
