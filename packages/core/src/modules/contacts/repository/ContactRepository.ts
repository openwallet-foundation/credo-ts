import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ContactRecord } from './ContactRecord'

@scoped(Lifecycle.ContainerScoped)
export class ContactRepository extends Repository<ContactRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<ContactRecord>) {
    super(ContactRecord, storageService)
  }
}
