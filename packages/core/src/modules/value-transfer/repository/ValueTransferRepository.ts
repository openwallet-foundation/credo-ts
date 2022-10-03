import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ValueTransferRecord } from './ValueTransferRecord'

@injectable()
export class ValueTransferRepository extends Repository<ValueTransferRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ValueTransferRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ValueTransferRecord, storageService, eventEmitter)
  }

  public async getByThread(threadId: string): Promise<ValueTransferRecord> {
    return this.getSingleByQuery({ threadId })
  }

  public async findByThread(threadId: string): Promise<ValueTransferRecord | null> {
    return this.findSingleByQuery({ threadId })
  }
}
