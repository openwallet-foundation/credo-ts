import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'

import { MdocVerificationSessionRecord } from './MdocVerificationSessionRecord'

@injectable()
export class MdocVerificationSessionRepository extends Repository<MdocVerificationSessionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<MdocVerificationSessionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(MdocVerificationSessionRecord, storageService, eventEmitter)
  }
}
