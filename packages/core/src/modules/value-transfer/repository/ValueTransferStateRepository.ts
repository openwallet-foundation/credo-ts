import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ValueTransferStateRecord } from './ValueTransferStateRecord'

@injectable()
export class ValueTransferStateRepository extends Repository<ValueTransferStateRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ValueTransferStateRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ValueTransferStateRecord, storageService, eventEmitter)
  }

  public getState(): Promise<ValueTransferStateRecord> {
    return this.getSingleByQuery({})
  }
}
