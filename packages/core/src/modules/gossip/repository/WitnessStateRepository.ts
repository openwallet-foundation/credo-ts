import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { WitnessStateRecord } from './WitnessStateRecord'

@injectable()
export class WitnessStateRepository extends Repository<WitnessStateRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<WitnessStateRecord>,
    eventEmitter: EventEmitter
  ) {
    super(WitnessStateRecord, storageService, eventEmitter)
  }
}
