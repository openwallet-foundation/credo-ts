import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'

import { ActionMenuRecord } from './ActionMenuRecord'

/**
 * @internal
 */
@injectable()
export class ActionMenuRepository extends Repository<ActionMenuRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ActionMenuRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ActionMenuRecord, storageService, eventEmitter)
  }
}
