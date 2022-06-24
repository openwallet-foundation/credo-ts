import { scoped, Lifecycle, inject } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { RecordNotFoundError } from '../../../error/RecordNotFoundError'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { AnonCredsSchemaRecord } from './AnonCredsSchemaRecord'

@scoped(Lifecycle.ContainerScoped)
export class AnonCredsSchemaRepository extends Repository<AnonCredsSchemaRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsSchemaRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsSchemaRecord, storageService, eventEmitter)
  }

  public async findBySchemaId(schemaId: string): Promise<AnonCredsSchemaRecord | null> {
    try {
      return await this.getBySchemaId(schemaId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }

  public async getBySchemaId(schemaId: string) {
    return this.getSingleByQuery({ schemaId: schemaId })
  }
}
