import { inject, scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { Repository } from '../../../../storage/Repository'
import { StorageService } from '../../../../storage/StorageService'

import { W3cCredentialRecord } from './W3cCredentialRecord'

@scoped(Lifecycle.ContainerScoped)
export class W3cCredentialRepository extends Repository<W3cCredentialRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<W3cCredentialRecord>,
    eventEmitter: EventEmitter
  ) {
    super(W3cCredentialRecord, storageService, eventEmitter)
  }
}
