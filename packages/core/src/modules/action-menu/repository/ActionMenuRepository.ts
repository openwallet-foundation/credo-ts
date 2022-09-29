import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ActionMenuRecord } from './ActionMenuRecord'

@injectable()
export class ActionMenuRepository extends Repository<ActionMenuRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ActionMenuRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ActionMenuRecord, storageService, eventEmitter)
  }
}
