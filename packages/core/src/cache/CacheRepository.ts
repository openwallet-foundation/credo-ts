import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { Repository } from '../storage/Repository'
import { StorageService } from '../storage/StorageService'

import { CacheRecord } from './CacheRecord'

@scoped(Lifecycle.ContainerScoped)
export class CacheRepository extends Repository<CacheRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<CacheRecord>) {
    super(CacheRecord, storageService)
  }
}
