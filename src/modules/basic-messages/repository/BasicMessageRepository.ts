import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

import { BasicMessageRecord } from './BasicMessageRecord'

@scoped(Lifecycle.ContainerScoped)
export class BasicMessageRepository extends Repository<BasicMessageRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<BasicMessageRecord>) {
    super(BasicMessageRecord, storageService)
  }
}
