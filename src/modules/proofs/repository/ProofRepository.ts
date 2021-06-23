import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ProofRecord } from './ProofRecord'

@scoped(Lifecycle.ContainerScoped)
export class ProofRepository extends Repository<ProofRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<ProofRecord>) {
    super(ProofRecord, storageService)
  }
}
