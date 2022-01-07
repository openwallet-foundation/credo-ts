import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { Repository } from '../Repository'
import { StorageService } from '../StorageService'

import { DidCommMessageRecord } from './DidCommMessageRecord'

@scoped(Lifecycle.ContainerScoped)
export class DidCommMessageRepository extends Repository<DidCommMessageRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommMessageRecord>) {
    super(DidCommMessageRecord, storageService)
  }
}
