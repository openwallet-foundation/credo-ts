import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { MediatorRoutingRecord } from './MediatorRoutingRecord'

@scoped(Lifecycle.ContainerScoped)
export class MediatorRoutingRepository extends Repository<MediatorRoutingRecord> {
  public readonly MEDIATOR_ROUTING_RECORD_ID = 'MEDIATOR_ROUTING_RECORD'

  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<MediatorRoutingRecord>) {
    super(MediatorRoutingRecord, storageService)
  }
}
