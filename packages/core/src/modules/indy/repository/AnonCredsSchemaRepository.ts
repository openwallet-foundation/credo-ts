import { scoped, Lifecycle, inject } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { AnonCredsSchemaRecord } from './AnonCredsSchemaRecord'

@scoped(Lifecycle.ContainerScoped)
export class AnonCredSchemaRepository extends Repository<AnonCredsSchemaRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsSchemaRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsSchemaRecord, storageService, eventEmitter)
  }

  public async getBySchemaId(schemaId: string) {
    return this.getSingleByQuery({ schemaId: schemaId })
  }
}
