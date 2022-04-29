import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ValueTransferStateRecord } from './ValueTransferStateRecord'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferStateRepository extends Repository<ValueTransferStateRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ValueTransferStateRecord>
  ) {
    super(ValueTransferStateRecord, storageService)
  }
}
