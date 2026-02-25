import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'

import { W3cCredentialRecord } from './W3cCredentialRecord'

@injectable()
export class W3cCredentialRepository extends Repository<W3cCredentialRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<W3cCredentialRecord>,
    eventEmitter: EventEmitter
  ) {
    super(W3cCredentialRecord, storageService, eventEmitter)
  }
}
