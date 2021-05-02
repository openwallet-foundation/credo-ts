import { inject, scoped, Lifecycle } from 'tsyringe'

import { Repository } from '../../../storage/Repository'
import { ProofRecord } from './ProofRecord'
import { StorageService } from '../../../storage/StorageService'

@scoped(Lifecycle.ContainerScoped)
export class ProofRepository extends Repository<ProofRecord> {
  public constructor(@inject('StorageService') storageService: StorageService<ProofRecord>) {
    super(ProofRecord, storageService)
  }
}
