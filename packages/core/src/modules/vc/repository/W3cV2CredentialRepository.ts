import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'
import { W3cV2CredentialRecord } from './W3cV2CredentialRecord'

@injectable()
export class W3cV2CredentialRepository extends Repository<W3cV2CredentialRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<W3cV2CredentialRecord>,
    eventEmitter: EventEmitter
  ) {
    super(W3cV2CredentialRecord, storageService, eventEmitter)
  }
}
