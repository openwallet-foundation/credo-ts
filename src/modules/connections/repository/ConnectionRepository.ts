import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { ConnectionRecord } from './ConnectionRecord'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionRepository extends Repository<ConnectionRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<ConnectionRecord>) {
    super(ConnectionRecord, storageService)
  }
}
