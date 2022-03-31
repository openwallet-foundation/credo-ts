import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { DidDocumentRole } from '../domain/DidDocumentRole'

import { DidRecord } from './DidRecord'

@scoped(Lifecycle.ContainerScoped)
export class DidRepository extends Repository<DidRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<DidRecord>) {
    super(DidRecord, storageService)
  }

  public findByVerkey(verkey: string) {
    return this.findSingleByQuery({ recipientKeys: [verkey] })
  }

  public getCreatedDids({ method }: { method?: string }) {
    return this.findByQuery({
      role: DidDocumentRole.Created,
      method,
    })
  }
}
