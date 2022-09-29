import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { WitnessStateRecord } from './WitnessStateRecord'

@scoped(Lifecycle.ContainerScoped)
export class WitnessStateRepository extends Repository<WitnessStateRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<WitnessStateRecord>) {
    super(WitnessStateRecord, storageService)
  }
}
