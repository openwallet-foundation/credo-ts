import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { GenericRecord } from './GenericRecord'

@scoped(Lifecycle.ContainerScoped)
export class GenericRecordRepository extends Repository<GenericRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<GenericRecord>) {
    super(GenericRecord, storageService)
  }
}
