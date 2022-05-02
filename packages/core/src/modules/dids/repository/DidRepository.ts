import type { Key } from '../../../crypto'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { DidRecord } from './DidRecord'

@injectable()
export class DidRepository extends Repository<DidRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidRecord, storageService, eventEmitter)
  }

  public findByRecipientKey(recipientKey: Key) {
    return this.findSingleByQuery({ recipientKeyFingerprints: [recipientKey.fingerprint] })
  }

  public findAllByRecipientKey(recipientKey: Key) {
    return this.findByQuery({ recipientKeyFingerprints: [recipientKey.fingerprint] })
  }
}
