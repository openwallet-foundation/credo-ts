import { EventEmitter, InjectionSymbols, Repository, type StorageService, inject, injectable } from '@credo-ts/core'

import { DidCommMediatorRoutingRecord } from './DidCommMediatorRoutingRecord'

@injectable()
export class DidCommMediatorRoutingRepository extends Repository<DidCommMediatorRoutingRecord> {
  public readonly MEDIATOR_ROUTING_RECORD_ID = 'MEDIATOR_ROUTING_RECORD'

  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommMediatorRoutingRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommMediatorRoutingRecord, storageService, eventEmitter)
  }
}
