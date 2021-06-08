import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

import { CredentialRecord } from './CredentialRecord'

@scoped(Lifecycle.ContainerScoped)
export class CredentialRepository extends Repository<CredentialRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<CredentialRecord>) {
    super(CredentialRecord, storageService)
  }
}
