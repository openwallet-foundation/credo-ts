import { inject, scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { BasicMessageRecord } from './BasicMessageRecord'

@scoped(Lifecycle.ContainerScoped)
export class BasicMessageRepository extends Repository<BasicMessageRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<BasicMessageRecord>,
    eventEmitter: EventEmitter
  ) {
    super(BasicMessageRecord, storageService, eventEmitter)
  }
}
