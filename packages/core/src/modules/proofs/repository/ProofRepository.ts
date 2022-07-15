import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ProofRecord } from './ProofRecord'

@injectable()
export class ProofRepository extends Repository<ProofRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ProofRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ProofRecord, storageService, eventEmitter)
  }
}
