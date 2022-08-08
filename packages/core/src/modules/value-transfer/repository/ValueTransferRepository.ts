import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ValueTransferRecord } from './ValueTransferRecord'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferRepository extends Repository<ValueTransferRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<ValueTransferRecord>) {
    super(ValueTransferRecord, storageService)
  }

  public async getByThread(threadId: string): Promise<ValueTransferRecord> {
    return this.getSingleByQuery({ threadId })
  }

  public async findByThread(threadId: string): Promise<ValueTransferRecord | null> {
    return this.findSingleByQuery({ threadId })
  }
}
