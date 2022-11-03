import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { MediatorRoutingRecord } from './MediatorRoutingRecord'

@injectable()
export class MediatorRoutingRepository extends Repository<MediatorRoutingRecord> {
  public readonly MEDIATOR_ROUTING_RECORD_ID = 'MEDIATOR_ROUTING_RECORD'

  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<MediatorRoutingRecord>,
    eventEmitter: EventEmitter
  ) {
    super(MediatorRoutingRecord, storageService, eventEmitter)
  }
}
