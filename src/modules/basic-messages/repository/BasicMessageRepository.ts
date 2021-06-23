import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { BasicMessageRecord } from './BasicMessageRecord'

@scoped(Lifecycle.ContainerScoped)
export class BasicMessageRepository extends Repository<BasicMessageRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<BasicMessageRecord>) {
    super(BasicMessageRecord, storageService)
  }
}
