import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { ConnectionRecord } from './ConnectionRecord'
import { StorageService } from '../../../storage/StorageService'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionRepository extends Repository<ConnectionRecord> {
  public constructor(@inject('StorageService') storageService: StorageService<ConnectionRecord>) {
    super(ConnectionRecord, storageService)
  }
}
