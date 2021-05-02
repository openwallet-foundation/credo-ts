import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { CredentialRecord } from './CredentialRecord'
import { StorageService } from '../../../storage/StorageService'

@scoped(Lifecycle.ContainerScoped)
export class CredentialRepository extends Repository<CredentialRecord> {
  public constructor(@inject('StorageService') storageService: StorageService<CredentialRecord>) {
    super(CredentialRecord, storageService)
  }
}
