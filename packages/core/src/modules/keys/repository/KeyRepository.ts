import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { KeyRecord } from './KeyRecord'

@injectable()
export class KeyRepository extends Repository<KeyRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<KeyRecord>,
    eventEmitter: EventEmitter
  ) {
    super(KeyRecord, storageService, eventEmitter)
  }

  public async getByKid(kid: string) {
    return this.getSingleByQuery({
      kid,
    })
  }

  public async findByKid(kid: string) {
    return this.findSingleByQuery({
      kid,
    })
  }
}
