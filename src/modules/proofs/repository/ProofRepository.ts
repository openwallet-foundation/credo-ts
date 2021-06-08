import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

import { ProofRecord } from './ProofRecord'

@scoped(Lifecycle.ContainerScoped)
export class ProofRepository extends Repository<ProofRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<ProofRecord>) {
    super(ProofRecord, storageService)
  }
}
