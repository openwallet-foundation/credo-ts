import type { StorageService } from '../../../storage/StorageService'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'

import { CredentialRecord } from './CredentialRecord'

@scoped(Lifecycle.ContainerScoped)
export class CredentialRepository extends Repository<CredentialRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<CredentialRecord>) {
    super(CredentialRecord, storageService)
  }
}
