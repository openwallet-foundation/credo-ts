import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'

import { MdocRecord } from './MdocRecord'

@injectable()
export class MdocRepository extends Repository<MdocRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<MdocRecord>,
    eventEmitter: EventEmitter
  ) {
    super(MdocRecord, storageService, eventEmitter)
  }
}
