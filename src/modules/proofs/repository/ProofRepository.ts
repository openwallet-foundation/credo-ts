import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { ProofRecord } from './ProofRecord'
import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'

@scoped(Lifecycle.ContainerScoped)
export class ProofRepository extends Repository<ProofRecord> {
  public constructor(@inject(Symbols.StorageService) storageService: StorageService<ProofRecord>) {
    super(ProofRecord, storageService)
  }
}
