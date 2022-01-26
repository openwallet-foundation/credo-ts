import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { DidDocumentRecord } from './DidDocumentRecord'

@scoped(Lifecycle.ContainerScoped)
export class DidDocumentRepository extends Repository<DidDocumentRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<DidDocumentRecord>) {
    super(DidDocumentRecord, storageService)
  }
}
