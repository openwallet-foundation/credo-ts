import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

import { ConnectionRecord } from './ConnectionRecord'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionRepository extends Repository<ConnectionRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<ConnectionRecord>) {
    super(ConnectionRecord, storageService)
  }
}
